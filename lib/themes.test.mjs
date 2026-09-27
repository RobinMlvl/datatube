import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { acceptProposal, assignVideo, deleteTheme, findOrCreateTheme, findThemeByPath, listThemes, recentTitlesByTheme, renameTheme, setThemeParent, themePath, themesById } from "./themes.mjs";

const NOW = Date.parse("2026-09-27T10:00:00.000Z");
function withVideo(db, id = "aaaaaaaaaaa", title = "Breakout 101") {
  db.prepare("INSERT INTO Video (id, url, title, state, createdAt, updatedAt) VALUES (?, 'u', ?, 'done', 't', 't')").run(id, title);
  return id;
}
const changes = (db, id) => db.prepare("SELECT changesSinceSheet FROM Theme WHERE id = ?").pluck().get(id);

describe("themes", () => {
  it("creates a theme under its parent once, whatever the case", () => {
    const db = openDb(":memory:");
    const a = findOrCreateTheme(db, { name: "Breakout Strategy", parent: "Trading" }, NOW);
    const b = findOrCreateTheme(db, { name: "breakout strategy", parent: "trading" }, NOW);
    expect(b.id).toBe(a.id);
    expect(listThemes(db).map((t) => t.name).sort()).toEqual(["Breakout Strategy", "Trading"]);
    expect(themePath(a, themesById(db))).toBe("Trading › Breakout Strategy");
    expect(findThemeByPath(db, "Trading")).toMatchObject({ parentId: null });
  });

  it("moves a video and counts the change on both themes", () => {
    const db = openDb(":memory:");
    const id = withVideo(db);
    const a = findOrCreateTheme(db, { name: "A" }, NOW);
    const b = findOrCreateTheme(db, { name: "B" }, NOW);
    assignVideo(db, id, a.id, "auto", NOW);
    assignVideo(db, id, b.id, "manual", NOW);
    expect([changes(db, a.id), changes(db, b.id)]).toEqual([2, 1]);
    expect(db.prepare("SELECT themeId, themeSource FROM Video WHERE id = ?").get(id)).toEqual({ themeId: b.id, themeSource: "manual" });
    assignVideo(db, id, b.id, "manual", NOW); // same theme: nothing changes
    expect(changes(db, b.id)).toBe(1);
  });

  it("accepts a proposal by creating its theme and filing the video by hand", () => {
    const db = openDb(":memory:");
    const id = withVideo(db);
    db.prepare("UPDATE Video SET themeSource = 'proposed', proposedTheme = ? WHERE id = ?").run(JSON.stringify({ name: "Scalping", parent: "Trading" }), id);
    const theme = acceptProposal(db, id, { name: "Scalping", parent: "Trading" }, NOW);
    expect(db.prepare("SELECT themeId, themeSource, proposedTheme FROM Video WHERE id = ?").get(id)).toEqual({ themeId: theme.id, themeSource: "manual", proposedTheme: null });
  });

  it("keeps two levels at most, and refuses a sibling with the same name", () => {
    const db = openDb(":memory:");
    const trading = findOrCreateTheme(db, { name: "Trading" }, NOW);
    const child = findOrCreateTheme(db, { name: "Scalping", parent: "Trading" }, NOW);
    const other = findOrCreateTheme(db, { name: "Crypto" }, NOW);
    expect(() => setThemeParent(db, other.id, child.id)).toThrow(/two levels/i);
    expect(() => setThemeParent(db, trading.id, other.id)).toThrow(/two levels/i);
    expect(() => setThemeParent(db, other.id, other.id)).toThrow();
    setThemeParent(db, other.id, trading.id);
    expect(themePath(themesById(db).get(other.id), themesById(db))).toBe("Trading › Crypto");
    expect(() => renameTheme(db, other.id, "scalping")).toThrow(/already exists/);
  });

  it("deletes only an empty theme without children", () => {
    const db = openDb(":memory:");
    const id = withVideo(db);
    const parent = findOrCreateTheme(db, { name: "Trading" }, NOW);
    const child = findOrCreateTheme(db, { name: "Scalping", parent: "Trading" }, NOW);
    assignVideo(db, id, child.id, "manual", NOW);
    expect(() => deleteTheme(db, parent.id)).toThrow(/sub-themes/);
    expect(() => deleteTheme(db, child.id)).toThrow(/videos/);
    assignVideo(db, id, null, null, NOW);
    deleteTheme(db, child.id);
    expect(listThemes(db).map((t) => t.name)).toEqual(["Trading"]);
  });

  it("lists a few recent titles per theme, for Jev's descriptions", () => {
    const db = openDb(":memory:");
    const t = findOrCreateTheme(db, { name: "Trading" }, NOW);
    for (const [id, title] of [["aaaaaaaaaaa", "One"], ["bbbbbbbbbbb", "Two"]]) {
      withVideo(db, id, title);
      assignVideo(db, id, t.id, "manual", NOW);
    }
    expect(recentTitlesByTheme(db).get(t.id).sort()).toEqual(["One", "Two"]);
  });
});
