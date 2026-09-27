import { describe, expect, it, vi } from "vitest";
import { openDb } from "../db.mjs";
import { claimNext, enqueue } from "../jobs.mjs";
import { findOrCreateTheme } from "../themes.mjs";
import { createSteps } from "./steps.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");
const META = { videoId: "aaaaaaaaaaa", title: "Breakout 101", channel: "Trader Joe", channelId: "UC1", durationS: 600, publishedAt: "2026-04-12", chapters: [{ startS: 0, title: "Intro" }], language: "en", subtitles: [], automaticCaptions: ["en-orig", "fr"] };
const VTT = "WEBVTT\n\n00:00:05.000 --> 00:00:05.010\nwait for the close\n";

function setup(youtube = {}) {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'queued', 't', 't')").run();
  const deps = {
    youtube: { fetchMetadata: vi.fn(async () => META), downloadSubtitle: vi.fn(async () => VTT), ...youtube },
    summarize: vi.fn(async () => ({ markdown: "# Breakout 101\n\n## 🎯 Core idea\nx", model: "deepseek-v4-flash" })),
    classify: vi.fn(async () => ({ kind: "proposed", proposal: { name: "Breakout", parent: "Trading" }, confidencePermille: 400 })),
  };
  const steps = createSteps({ db, ...deps, now: () => T0 });
  const runNext = async () => steps.run(claimNext(db, T0));
  return { db, deps, runNext };
}
const video = (db) => db.prepare("SELECT * FROM Video WHERE id = 'aaaaaaaaaaa'").get();

describe("the three steps of a video", () => {
  it("fetches, summarizes and classifies, each step queuing the next", async () => {
    const { db, deps, runNext } = setup();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    await runNext();
    expect(video(db)).toMatchObject({ state: "summarizing", title: "Breakout 101", durationS: 600, language: "en", chapters: '[{"startS":0,"title":"Intro"}]' });
    expect(deps.youtube.downloadSubtitle).toHaveBeenCalledWith("aaaaaaaaaaa", { lang: "en-orig", kind: "auto" });
    expect(db.prepare("SELECT text, kind FROM Transcript").get()).toEqual({ text: "[00:05] wait for the close", kind: "auto" });
    await runNext();
    expect(db.prepare("SELECT model FROM Summary").pluck().get()).toBe("deepseek-v4-flash");
    expect(video(db).state).toBe("classifying");
    await runNext();
    expect(video(db)).toMatchObject({ state: "done", themeSource: "proposed" });
    expect(db.prepare("SELECT COUNT(*) FROM SearchIndex WHERE SearchIndex MATCH '\"close\"'").pluck().get()).toBe(1);
  });

  it("marks a video without subtitles, and stops there", async () => {
    const { db, runNext } = setup({ fetchMetadata: vi.fn(async () => ({ ...META, automaticCaptions: [] })) });
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    await runNext();
    expect(video(db)).toMatchObject({ state: "no_transcript", error: "YouTube has no subtitles for this video." });
    expect(db.prepare("SELECT COUNT(*) FROM Job WHERE state = 'queued'").pluck().get()).toBe(0);
  });

  it("moves to the next track when YouTube rate-limits one language", async () => {
    const limited = Object.assign(new Error("HTTP Error 429"), { rateLimited: true });
    const downloadSubtitle = vi.fn().mockRejectedValueOnce(limited).mockResolvedValueOnce(VTT);
    // Manual French subtitles make a second candidate (French AUTO would be a translation of the spoken English).
    const { db, runNext } = setup({ downloadSubtitle, fetchMetadata: vi.fn(async () => ({ ...META, subtitles: ["fr"] })) });
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    await runNext();
    expect(downloadSubtitle.mock.calls.map(([, t]) => t.lang)).toEqual(["en-orig", "fr"]);
    expect(video(db).language).toBe("fr");
  });

  it("throws the rate limit when every track is limited", async () => {
    const limited = Object.assign(new Error("HTTP Error 429"), { rateLimited: true });
    const { db, runNext } = setup({ downloadSubtitle: vi.fn(async () => { throw limited; }) });
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    await expect(runNext()).rejects.toBe(limited);
  });

  it("does not re-classify a video that already has its theme", async () => {
    const { db, deps, runNext } = setup();
    const t = findOrCreateTheme(db, { name: "Trading" }, T0);
    db.prepare("UPDATE Video SET themeId = ?, themeSource = 'manual' WHERE id = 'aaaaaaaaaaa'").run(t.id);
    db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', '[00:05] x', 9)").run();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "summarize", now: T0 });
    await runNext();
    expect(video(db).state).toBe("done");
    expect(deps.classify).not.toHaveBeenCalled();
  });
});
