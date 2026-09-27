import { describe, expect, it } from "vitest";
import { openDb } from "../db.mjs";
import { claimNext, enqueue, failJob, latestJob } from "../jobs.mjs";
import { regenerateSummary, retryVideo } from "./requeue.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");
function withVideo(state) {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', ?, 't', 't')").run(state);
  return db;
}

describe("retry and regenerate", () => {
  it("retries the step that failed", () => {
    const db = withVideo("failed");
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "summarize", now: T0 });
    failJob(db, claimNext(db, T0), "boom", T0, { final: true });
    retryVideo(db, "aaaaaaaaaaa", T0);
    expect(latestJob(db, "aaaaaaaaaaa")).toMatchObject({ step: "summarize", state: "queued" });
    expect(db.prepare("SELECT state, error FROM Video").get()).toEqual({ state: "summarizing", error: null });
  });

  it("fetches again a video that had no subtitles, and refuses a video in progress", () => {
    const db = withVideo("no_transcript");
    retryVideo(db, "aaaaaaaaaaa", T0);
    expect(latestJob(db, "aaaaaaaaaaa")).toMatchObject({ step: "fetch" });
    expect(() => retryVideo(db, "aaaaaaaaaaa", T0)).toThrow(/only a failed/i);
  });

  it("regenerates a summary from the stored transcript, once at a time", () => {
    const db = withVideo("done");
    expect(() => regenerateSummary(db, "aaaaaaaaaaa", T0)).toThrow(/no transcript/i);
    db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', '[00:01] a', 9)").run();
    regenerateSummary(db, "aaaaaaaaaaa", T0);
    expect(latestJob(db, "aaaaaaaaaaa")).toMatchObject({ step: "summarize", state: "queued" });
    expect(() => regenerateSummary(db, "aaaaaaaaaaa", T0)).toThrow(/already being processed/);
  });
});
