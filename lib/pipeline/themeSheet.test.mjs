import { describe, expect, it, vi } from "vitest";
import { openDb } from "../db.mjs";
import { THEME_SYSTEM } from "./prompts.mjs";
import { buildThemeSheet, packBlocks, saveThemeSheet } from "./themeSheet.mjs";

const BODY = "## 🎯 What this theme is about\nx\n## 💡 Consolidated knowledge\n### A\n- p — [Breakout 101 · 01:05]\n## 🛠️ In practice\n- s\n## ⚠️ Disagreements between videos\nNot in the videos";
const sheet = (title, words = 10) => `# ${title}\nmeta\n\n## 🎯 Core idea\n${"idea ".repeat(words)}\n## 📊 Chapters\n- c\n## 💡 Key points\n- k\n## 🛠️ In practice\n- s`;
const VIDEOS = [
  { id: "aaaaaaaaaaa", title: "Breakout 101", channel: "Trader Joe", summary: sheet("Breakout 101") },
  { id: "bbbbbbbbbbb", title: "Stops", channel: "Ann", summary: sheet("Stops") },
  { id: "ccccccccccc", title: "Not yet", channel: "Ann", summary: null },
];

describe("packBlocks", () => {
  it("fills packs up to the limit, and gives an oversized block its own pack", () => {
    expect(packBlocks(["aaaa", "bbbb", "cccc"], 9)).toEqual([["aaaa", "bbbb"], ["cccc"]]);
    expect(packBlocks(["x".repeat(20), "y"], 9)).toEqual([["x".repeat(20)], ["y"]]);
  });
});

describe("buildThemeSheet", () => {
  it("merges the summarized videos in one call, code writing the title and the sources", async () => {
    const complete = vi.fn(async () => ({ text: `Sure.\n${BODY}` }));
    const md = await buildThemeSheet({ path: "Trading › Breakout", videos: VIDEOS, model: "m", complete, themeId: 7 });
    expect(complete).toHaveBeenCalledTimes(1);
    const call = complete.mock.calls[0][0];
    expect(call).toMatchObject({ model: "m", system: THEME_SYSTEM, feature: "theme_sheet", themeId: 7 });
    expect(call.maxTokens).toBeUndefined(); // the client's roomy default applies: a merged sheet can be long
    expect(call.user).toContain("Theme: Trading › Breakout");
    expect(call.user).toContain("### Breakout 101");
    expect(call.user).not.toContain("meta"); // each video's header stays out
    expect(md.startsWith("# Trading › Breakout\n\n## 🎯 What this theme is about")).toBe(true);
    expect(md).toContain("## 📚 Sources\n- [Breakout 101](https://www.youtube.com/watch?v=aaaaaaaaaaa) — Trader Joe\n- [Stops](https://www.youtube.com/watch?v=bbbbbbbbbbb) — Ann");
    expect(md).not.toContain("Not yet");
  });

  it("merges in packs, then the partial sheets, when the theme is large", async () => {
    const big = Array.from({ length: 6 }, (_, i) => ({ id: `v${String(i).padStart(10, "0")}`, title: `V${i}`, channel: "c", summary: sheet(`V${i}`, 3000) }));
    const complete = vi.fn(async () => ({ text: BODY }));
    await buildThemeSheet({ path: "Trading", videos: big, model: "m", complete, themeId: 1 });
    const features = complete.mock.calls.map(([c]) => c.feature);
    expect(features.filter((f) => f === "theme_sheet_part").length).toBeGreaterThan(1);
    expect(features.at(-1)).toBe("theme_sheet");
  });

  it("refuses a theme with no summarized video, and a sheet missing a section", async () => {
    await expect(buildThemeSheet({ path: "T", videos: [VIDEOS[2]], model: "m", complete: vi.fn() })).rejects.toThrow(/no summarized video/);
    await expect(buildThemeSheet({ path: "T", videos: VIDEOS, model: "m", complete: vi.fn(async () => ({ text: "## 🎯 What this theme is about\nx" })) }))
      .rejects.toMatchObject({ code: "bad_format" });
  });
});

describe("saveThemeSheet", () => {
  it("stores the sheet and resets its staleness", () => {
    const db = openDb(":memory:");
    const id = db.prepare("INSERT INTO Theme (name, changesSinceSheet, createdAt) VALUES ('Trading', 4, 't')").run().lastInsertRowid;
    saveThemeSheet(db, id, "# Trading", "deepseek-v4-flash", Date.parse("2026-09-27T10:00:00.000Z"));
    expect(db.prepare("SELECT sheetMarkdown, sheetModel, sheetGeneratedAt, changesSinceSheet FROM Theme").get()).toEqual({
      sheetMarkdown: "# Trading", sheetModel: "deepseek-v4-flash", sheetGeneratedAt: "2026-09-27T10:00:00.000Z", changesSinceSheet: 0,
    });
  });

  it("keeps counting the changes made while the sheet was being written", () => {
    const db = openDb(":memory:");
    const id = db.prepare("INSERT INTO Theme (name, changesSinceSheet, createdAt) VALUES ('Trading', 4, 't')").run().lastInsertRowid;
    saveThemeSheet(db, id, "# Trading", "deepseek-v4-flash", Date.parse("2026-09-27T10:00:00.000Z"), { seenChanges: 3 });
    expect(db.prepare("SELECT changesSinceSheet FROM Theme").pluck().get()).toBe(1);
  });
});
