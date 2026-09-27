import { describe, expect, it, vi } from "vitest";
import { CHUNK_OVERLAP, CHUNK_SIZE, chunkTranscript, summarizeVideo } from "./summarize.mjs";
import { NOTES_SYSTEM, SUMMARY_SYSTEM } from "./prompts.mjs";

const VIDEO = { id: "dQw4w9WgXcQ", title: "Breakout strategy", channel: "Trader Joe", durationS: 600, language: "en", publishedAt: "2026-04-12", chapters: '[{"startS":0,"title":"Intro"}]' };
const BODY = "## 📝 Summary\nx\n## 🎯 Key takeaways\n- b\n## 🛠️ Method\nNot in the video";
const line = (i) => `[${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}] ${"word ".repeat(18)}`;
const transcriptOf = (lines) => Array.from({ length: lines }, (_, i) => line(i)).join("\n");

describe("chunkTranscript", () => {
  it("cuts on line boundaries, each part at most the size, the next one re-reading ~2K characters", () => {
    const text = transcriptOf(1200); // ~120K characters
    const chunks = chunkTranscript(text);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(CHUNK_SIZE);
    const [a, b] = chunks;
    const overlap = a.text.split("\n").filter((l) => b.text.split("\n").includes(l)).join("\n").length;
    expect(overlap).toBeGreaterThan(CHUNK_OVERLAP - 200);
    expect(overlap).toBeLessThanOrEqual(CHUNK_OVERLAP);
    expect(chunks[0].from).toBe("00:00");
    expect(chunks.at(-1).text.endsWith(line(1199))).toBe(true);
  });

  it("returns one part for a short transcript, and always moves forward", () => {
    expect(chunkTranscript("[00:01] hi").map((c) => c.text)).toEqual(["[00:01] hi"]);
    const huge = `[00:00] ${"x".repeat(50_000)}\n[00:01] y`;
    expect(chunkTranscript(huge).length).toBe(2); // a line longer than the size is its own part
  });
});

describe("summarizeVideo", () => {
  it("summarizes a short transcript in one call, with the rules", async () => {
    const complete = vi.fn(async () => ({ text: `Here you go\n${BODY}` }));
    const sheet = await summarizeVideo({ video: VIDEO, transcript: "[00:05] b", model: "deepseek-v4-flash", complete });
    expect(complete).toHaveBeenCalledTimes(1);
    const call = complete.mock.calls[0][0];
    expect(call).toMatchObject({ model: "deepseek-v4-flash", system: SUMMARY_SYSTEM, feature: "summary" });
    expect(call.user).toContain("[00:05] b");
    expect(sheet.startsWith("# Breakout strategy\n**Channel:** Trader Joe")).toBe(true);
    expect(sheet).toContain("## 📝 Summary\nx");
    expect(sheet).not.toContain("Here you go");
  });

  it("takes notes part by part on a long transcript, then merges them into one sheet", async () => {
    const complete = vi.fn(async ({ feature }) => ({ text: feature === "summary_notes" ? "- a rule" : BODY }));
    await summarizeVideo({ video: VIDEO, transcript: transcriptOf(1200), model: "deepseek-v4-flash", complete });
    const features = complete.mock.calls.map(([c]) => c.feature);
    expect(features.at(-1)).toBe("summary_merge");
    expect(features.filter((f) => f === "summary_notes").length).toBeGreaterThan(2);
    expect(complete.mock.calls[0][0].system).toBe(NOTES_SYSTEM);
    expect(complete.mock.calls.at(-1)[0].user).toContain("### Part 1");
  });

  it("accepts a sheet whose 🛠️ heading lost its invisible variation selector, and stores it exact", async () => {
    const loose = BODY.replace("## 🛠️ Method", "## \u{1F6E0} Method");
    const sheet = await summarizeVideo({ video: VIDEO, transcript: "[00:05] b", model: "m", complete: vi.fn(async () => ({ text: loose })) });
    expect(sheet).toContain("## 🛠️ Method");
  });

  it("refuses a sheet that misses a section — the job will try again", async () => {
    const complete = vi.fn(async () => ({ text: "## 📝 Summary\nonly this" }));
    await expect(summarizeVideo({ video: VIDEO, transcript: "[00:01] a", model: "m", complete })).rejects.toMatchObject({ code: "bad_format" });
  });
});

describe("the rules travel with every prompt", () => {
  it("says the transcript is the only source, only useful data is kept, condensed, and an empty section says so", () => {
    for (const system of [SUMMARY_SYSTEM, NOTES_SYSTEM]) {
      expect(system).toContain("only source");
      expect(system).toContain("Keep only useful data");
      expect(system).toContain("no quotes, no timestamps");
      expect(system).toContain("Not in the video");
      expect(system).toContain("English");
    }
    expect(SUMMARY_SYSTEM).toContain("under 400 words");
  });
});
