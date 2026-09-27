import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db.mjs";
import { saveThemeSheet } from "../lib/pipeline/themeSheet.mjs";
import { indexVideo } from "../lib/search.mjs";
import { assignVideo, findOrCreateTheme } from "../lib/themes.mjs";
import { listThemesText, searchText, themeSheetText, transcriptRangeText, videoSheetText } from "./tools.mjs";

const NOW = Date.parse("2026-09-27T10:00:00.000Z");
function library() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, title, channel, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'Breakout 101', 'Trader Joe', 'done', 't', 't')").run();
  db.prepare("INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES ('aaaaaaaaaaa', '# Breakout 101\n\n## 🎯 Core idea\nTrade the range.', 'deepseek-v4-flash', 't')").run();
  db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', ?, 60)").run("[00:05] hello\n[01:05] wait for the close\n[1:02:03] late");
  indexVideo(db, "aaaaaaaaaaa");
  const theme = findOrCreateTheme(db, { name: "Breakout", parent: "Trading" }, NOW);
  assignVideo(db, "aaaaaaaaaaa", theme.id, "auto", NOW);
  return { db, theme };
}

describe("MCP tools", () => {
  it("lists the themes as a tree with their ids", () => {
    const { db, theme } = library();
    expect(listThemesText(db)).toBe(`- Trading (themeId ${theme.parentId}, 0 videos, sheet: none)\n  - Trading › Breakout (themeId ${theme.id}, 1 video, sheet: none)`);
    expect(listThemesText(openDb(":memory:"))).toBe("The library has no theme yet.");
  });

  it("searches and points to the video id", () => {
    const { db } = library();
    expect(searchText(db, { query: "close" })).toContain("Breakout 101 (videoId aaaaaaaaaaa) — theme: Trading › Breakout");
    expect(searchText(db, { query: "nothing" })).toBe('No video matches "nothing".');
  });

  it("returns a video sheet with its provenance", () => {
    const { db } = library();
    const text = videoSheetText(db, { videoId: "aaaaaaaaaaa" });
    expect(text).toContain('source: "https://www.youtube.com/watch?v=aaaaaaaaaaa"');
    expect(text).toContain("## 🎯 Core idea");
    expect(videoSheetText(db, { videoId: "zzzzzzzzzzz" })).toBe("No video with id zzzzzzzzzzz.");
  });

  it("returns a theme sheet by id or by name, and says when it is missing or stale", () => {
    const { db, theme } = library();
    expect(themeSheetText(db, { name: "Trading › Breakout" })).toContain("No consolidated sheet yet");
    saveThemeSheet(db, theme.id, "# Trading › Breakout\n\nbody", "deepseek-v4-flash", NOW);
    const text = themeSheetText(db, { themeId: theme.id });
    expect(text).toContain("body");
    expect(text).toContain("- Breakout 101 (videoId aaaaaaaaaaa)");
    expect(themeSheetText(db, { name: "Cooking" })).toContain("No theme matches");
  });

  it("returns the transcript, whole or on a range", () => {
    const { db } = library();
    expect(transcriptRangeText(db, { videoId: "aaaaaaaaaaa", from: "01:00", to: "02:00" })).toBe("[01:05] wait for the close");
    expect(transcriptRangeText(db, { videoId: "aaaaaaaaaaa", from: "1:00:00" })).toBe("[1:02:03] late");
    expect(transcriptRangeText(db, { videoId: "aaaaaaaaaaa", from: "soon" })).toContain("timestamps like");
  });
});
