import { describe, expect, it } from "vitest";
import { canonicalVideoUrl, classifyInput, parseInput, videoIdOf } from "./urls.mjs";

describe("videoIdOf", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://vimeo.com/123", null],
    ["https://www.youtube.com/watch?v=short", null],
    ["not a link", null],
  ])("%s → %s", (input, id) => expect(videoIdOf(input)).toBe(id));
});

describe("classifyInput", () => {
  it("reads a video — even one opened inside a playlist", () => {
    expect(classifyInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123")).toEqual({
      kind: "video", videoId: "dQw4w9WgXcQ", url: canonicalVideoUrl("dQw4w9WgXcQ"),
    });
  });

  it("reads a playlist", () => {
    expect(classifyInput("https://www.youtube.com/playlist?list=PLabc_123")).toEqual({
      kind: "playlist", url: "https://www.youtube.com/playlist?list=PLabc_123",
    });
  });

  it("reads a channel under any of its addresses, always on its Videos tab", () => {
    for (const [input, url] of [
      ["https://www.youtube.com/@TraderJoe", "https://www.youtube.com/@TraderJoe/videos"],
      ["https://www.youtube.com/@TraderJoe/featured", "https://www.youtube.com/@TraderJoe/videos"],
      ["https://youtube.com/@TraderJoe/shorts", "https://www.youtube.com/@TraderJoe/videos"],
      ["https://www.youtube.com/channel/UC1234567890abcdefghijk", "https://www.youtube.com/channel/UC1234567890abcdefghijk/videos"],
      ["https://www.youtube.com/c/TraderJoe/about", "https://www.youtube.com/c/TraderJoe/videos"],
      ["https://www.youtube.com/user/traderjoe", "https://www.youtube.com/user/traderjoe/videos"],
    ]) expect(classifyInput(input)).toEqual({ kind: "channel", url });
  });

  it("says what it could not read", () => {
    expect(classifyInput("https://example.com")).toEqual({ kind: "invalid", input: "https://example.com" });
  });
});

describe("parseInput", () => {
  it("reads one link per line, skips blanks, comments and exact duplicates", () => {
    const text = "\n https://youtu.be/dQw4w9WgXcQ \n# my notes\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@TraderJoe\nnope\n";
    expect(parseInput(text).map((i) => i.kind)).toEqual(["video", "channel", "invalid"]);
  });
});
