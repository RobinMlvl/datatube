import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { ftsQuery, indexVideo, searchVideos } from "./search.mjs";

const T = "2026-09-27T10:00:00.000Z";
function seed(db) {
  db.prepare("INSERT INTO Video (id, url, title, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'Breakout strategy', 'done', ?, ?)").run(T, T);
  db.prepare("INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES ('aaaaaaaaaaa', '## 🎯 Core idea\nTrade the range breakout with a stop under the range.', 'm', ?)").run(T);
  db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', '[01:05] wait for the candle to close above resistance', 50)").run();
  indexVideo(db, "aaaaaaaaaaa");
}

describe("search", () => {
  it("finds a video by its title, its summary or its transcript", () => {
    const db = openDb(":memory:");
    seed(db);
    expect(searchVideos(db, "breakout").map((r) => r.videoId)).toEqual(["aaaaaaaaaaa"]);
    expect(searchVideos(db, "resistance")[0].snippet).toContain("resistance");
    expect(searchVideos(db, "nothing-like-this")).toEqual([]);
  });

  it("re-indexes a video instead of duplicating it", () => {
    const db = openDb(":memory:");
    seed(db);
    indexVideo(db, "aaaaaaaaaaa");
    expect(db.prepare("SELECT COUNT(*) FROM SearchIndex").pluck().get()).toBe(1);
  });

  it("never lets a user's query break FTS syntax", () => {
    const db = openDb(":memory:");
    seed(db);
    expect(() => searchVideos(db, 'breakout" OR (')).not.toThrow();
    expect(ftsQuery('a "b" c*')).toBe('"a" "b" "c"');
    expect(ftsQuery("   ")).toBe("");
    expect(searchVideos(db, "   ")).toEqual([]);
  });
});
