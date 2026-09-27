import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { recordApiCall } from "./costs.mjs";
import { indexVideo } from "./search.mjs";
import { assignVideo, findOrCreateTheme } from "./themes.mjs";
import { findTheme, getTheme, getVideo, libraryCounts, listVideos, queueStatus, reviewQueue, themeOptions, themeTree, themeVideosWithSummaries } from "./queries.mjs";
import { setSetting } from "./settings.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");
function library() {
  const db = openDb(":memory:");
  const add = (id, title, state) => db.prepare("INSERT INTO Video (id, url, title, state, createdAt, updatedAt) VALUES (?, 'u', ?, ?, ?, ?)").run(id, title, state, "2026-09-27T10:00:00.000Z", "2026-09-27T10:00:00.000Z");
  add("aaaaaaaaaaa", "Breakout 101", "done");
  add("bbbbbbbbbbb", "Scalping", "done");
  add("ccccccccccc", "Pending", "fetching");
  add("ddddddddddd", "Broken", "failed");
  const breakout = findOrCreateTheme(db, { name: "Breakout", parent: "Trading" }, T0);
  assignVideo(db, "aaaaaaaaaaa", breakout.id, "auto", T0);
  db.prepare("UPDATE Video SET themeSource = 'proposed', proposedTheme = ? WHERE id = 'bbbbbbbbbbb'").run(JSON.stringify({ name: "Scalping", parent: "Trading" }));
  db.prepare("INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES ('aaaaaaaaaaa', '# Breakout 101', 'm', 't')").run();
  db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES ('aaaaaaaaaaa', 'en', 'auto', '[00:05] range', 13)").run();
  indexVideo(db, "aaaaaaaaaaa");
  recordApiCall(db, { provider: "deepseek", feature: "summary", costMicrousd: 2106, videoId: "aaaaaaaaaaa", at: T0 });
  recordApiCall(db, { provider: "typesafe", feature: "classify", costMicrousd: 42, videoId: "aaaaaaaaaaa", at: T0 });
  return { db, breakout };
}

describe("queries", () => {
  it("lists videos with their theme path and their cost, and filters them", () => {
    const { db, breakout } = library();
    const all = listVideos(db, {});
    expect(all).toHaveLength(4);
    expect(all.find((v) => v.id === "aaaaaaaaaaa")).toMatchObject({ themePath: "Trading › Breakout", costMicrousd: 2148 });
    expect(listVideos(db, { themeId: breakout.parentId }).map((v) => v.id)).toEqual(["aaaaaaaaaaa"]); // a parent shows its children's videos
    expect(listVideos(db, { state: "active" }).map((v) => v.id)).toEqual(["ccccccccccc"]);
    expect(listVideos(db, { state: "review" }).map((v) => v.id)).toEqual(["bbbbbbbbbbb"]);
    expect(listVideos(db, { q: "range" }).map((v) => v.id)).toEqual(["aaaaaaaaaaa"]);
  });

  it("reads one video with everything its page needs", () => {
    const { db } = library();
    expect(getVideo(db, "aaaaaaaaaaa")).toMatchObject({ themePath: "Trading › Breakout", summary: "# Breakout 101", transcript: "[00:05] range", costMicrousd: 2148, lastJob: null });
    expect(getVideo(db, "zzzzzzzzzzz")).toBeNull();
  });

  it("builds the theme tree and a theme's page", () => {
    const { db, breakout } = library();
    const tree = themeTree(db);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: "Trading", path: "Trading", videoCount: 0 });
    expect(tree[0].children[0]).toMatchObject({ name: "Breakout", path: "Trading › Breakout", videoCount: 1, changesSinceSheet: 1 });
    expect(getTheme(db, breakout.id)).toMatchObject({ path: "Trading › Breakout", videos: [{ id: "aaaaaaaaaaa" }] });
    expect(themeVideosWithSummaries(db, breakout.id)).toMatchObject([{ id: "aaaaaaaaaaa", summary: "# Breakout 101" }]);
    expect(findTheme(db, { name: "trading › breakout" }).id).toBe(breakout.id);
    expect(findTheme(db, { name: "Breakout" }).id).toBe(breakout.id);
    expect(findTheme(db, { themeId: 999 })).toBeNull();
  });

  it("gives Review its proposals, and the sidebar its counts", () => {
    const { db } = library();
    expect(reviewQueue(db)).toMatchObject([{ id: "bbbbbbbbbbb", proposal: { name: "Scalping", parent: "Trading" } }]);
    expect(libraryCounts(db)).toEqual({ total: 4, review: 1, failed: 1, active: 1, noTranscript: 0 });
  });

  it("says when the YouTube queue is paused", () => {
    const { db } = library();
    expect(queueStatus(db, T0)).toEqual({ pausedUntil: null, pendingJobs: 0 });
    setSetting(db, "queuePausedUntil", T0 + 60_000);
    expect(queueStatus(db, T0).pausedUntil).toBe(T0 + 60_000);
    expect(queueStatus(db, T0 + 60_000).pausedUntil).toBeNull();
  });

  it("lists every theme by its path, for pickers", () => {
    const { db } = library();
    expect(themeOptions(db)).toEqual([
      { id: expect.any(Number), path: "Trading" },
      { id: expect.any(Number), path: "Trading › Breakout" },
    ]);
  });
});
