import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { YtDlpError, checkTools, classifyError, downloadSubtitle, entriesOf, fetchMetadata, listEntries, metadataOf, trackCandidates } from "./ytdlp.mjs";

const json = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("entriesOf", () => {
  it("flattens a playlist, nested tabs included, and leaves out private videos and tabs", () => {
    expect(entriesOf(json("playlist.sample.json"))).toEqual([
      { videoId: "dQw4w9WgXcQ", title: "Part 1" },
      { videoId: "bbbbbbbbbbb", title: "Part 2" },
    ]);
  });

  it("reads a single video as one entry", () => {
    expect(entriesOf({ id: "dQw4w9WgXcQ", title: "Solo" })).toEqual([{ videoId: "dQw4w9WgXcQ", title: "Solo" }]);
  });

  it("asks yt-dlp for the flat list of the URL", async () => {
    const run = vi.fn(async () => JSON.stringify(json("playlist.sample.json")));
    await listEntries("https://www.youtube.com/playlist?list=PLabc_123", { run });
    expect(run).toHaveBeenCalledWith(["--flat-playlist", "-J", "--no-warnings", "https://www.youtube.com/playlist?list=PLabc_123"]);
  });
});

describe("metadataOf", () => {
  it("keeps what the library stores, and the subtitle languages without live chat", () => {
    expect(metadataOf(json("metadata.sample.json"))).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Breakout trading strategy explained",
      channel: "Trader Joe",
      channelId: "UC1234567890abcdefghijk",
      durationS: 3753,
      publishedAt: "2026-04-12",
      chapters: [{ startS: 0, title: "Intro" }, { startS: 95, title: "The setup" }],
      language: "en",
      subtitles: ["fr"],
      automaticCaptions: ["en-orig", "en", "fr", "de"],
    });
  });

  it("leaves unknown fields null, never 0", () => {
    const m = metadataOf({ id: "dQw4w9WgXcQ" });
    expect(m).toMatchObject({ title: null, channel: null, durationS: null, publishedAt: null, language: null, chapters: [], subtitles: [], automaticCaptions: [] });
  });

  it("fetches one video's metadata without downloading it", async () => {
    const run = vi.fn(async () => JSON.stringify(json("metadata.sample.json")));
    await fetchMetadata("dQw4w9WgXcQ", { run });
    expect(run).toHaveBeenCalledWith(["-J", "--skip-download", "--ignore-no-formats-error", "--no-warnings", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"]);
  });
});

describe("trackCandidates — the spoken words first, never a machine translation when the language is known", () => {
  it("prefers the original-language auto track over another language's manual subtitles", () => {
    expect(trackCandidates(metadataOf(json("metadata.sample.json")))).toEqual([
      { lang: "en-orig", kind: "auto" },
      { lang: "fr", kind: "manual" },
    ]);
  });

  it("takes manual subtitles in the spoken language first", () => {
    expect(trackCandidates({ language: "fr", subtitles: ["fr", "en"], automaticCaptions: ["fr"] })[0]).toEqual({ lang: "fr", kind: "manual" });
  });

  it("falls back to French then English auto tracks only when the spoken language is unknown", () => {
    expect(trackCandidates({ language: null, subtitles: [], automaticCaptions: ["de", "en", "fr"] })).toEqual([
      { lang: "fr", kind: "auto" },
      { lang: "en", kind: "auto" },
    ]);
  });

  it("finds the spoken language from the -orig track when yt-dlp does not name it", () => {
    expect(trackCandidates({ language: null, subtitles: [], automaticCaptions: ["es-orig", "es", "en"] })[0]).toEqual({ lang: "es-orig", kind: "auto" });
  });

  it("returns nothing when the video has no subtitles at all", () => {
    expect(trackCandidates({ language: "en", subtitles: [], automaticCaptions: [] })).toEqual([]);
  });
});

describe("downloadSubtitle", () => {
  it("writes the chosen track into a temporary folder, reads it back and cleans up", async () => {
    let folder = null;
    const run = vi.fn(async (args) => {
      const template = args[args.indexOf("-o") + 1];
      folder = path.dirname(template);
      fs.writeFileSync(path.join(folder, "dQw4w9WgXcQ.en-orig.vtt"), "WEBVTT\n");
      return "";
    });
    const vtt = await downloadSubtitle("dQw4w9WgXcQ", { lang: "en-orig", kind: "auto" }, { run });
    expect(vtt).toBe("WEBVTT\n");
    const args = run.mock.calls[0][0];
    expect(args).toEqual(expect.arrayContaining(["--skip-download", "--ignore-no-formats-error", "--write-auto-subs", "--sub-format", "vtt"]));
    expect(args[args.indexOf("--sub-langs") + 1]).toBe("^en-orig$");
    expect(fs.existsSync(folder)).toBe(false);
  });

  it("returns null when yt-dlp wrote no subtitle", async () => {
    expect(await downloadSubtitle("dQw4w9WgXcQ", { lang: "fr", kind: "manual" }, { run: async () => "" })).toBeNull();
  });
});

describe("classifyError", () => {
  it("names a rate limit, an unavailable video and a missing binary", () => {
    expect(classifyError(new Error("exit 1"), "ERROR: [youtube] x: HTTP Error 429: Too Many Requests").rateLimited).toBe(true);
    expect(classifyError(new Error("exit 1"), "ERROR: [youtube] x: Private video. Sign in").unavailable).toBe(true);
    expect(classifyError(new Error("exit 1"), "ERROR: [youtube] x: Sign in to confirm you’re not a bot").rateLimited).toBe(true);
    const missing = classifyError(Object.assign(new Error("spawn yt-dlp ENOENT"), { code: "ENOENT" }), "");
    expect(missing).toBeInstanceOf(YtDlpError);
    expect(missing.missing).toBe(true);
    expect(missing.message).toContain("brew install yt-dlp deno");
  });

  it("keeps the last ERROR line as the message", () => {
    expect(classifyError(new Error("x"), "WARNING: a\nERROR: [youtube] abc: Video unavailable\n").message).toBe("ERROR: [youtube] abc: Video unavailable");
  });
});

describe("checkTools", () => {
  it("reports each tool's version, or null when it is missing", async () => {
    const exec = vi.fn(async (bin) => { if (bin === "deno") throw new Error("ENOENT"); return "2026.09.01\n"; });
    expect(await checkTools({ exec })).toEqual({ ytDlp: "2026.09.01", deno: null });
  });
});
