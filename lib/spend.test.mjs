import { describe, expect, it } from "vitest";
import { recordApiCall } from "./costs.mjs";
import { openDb } from "./db.mjs";
import { getSetting } from "./settings.mjs";
import { reconcileDeepseek, recentCalls, spendByDay, spendByFeature, spendByProvider, spendOverview, topThemes, topVideos } from "./spend.mjs";
import { findOrCreateTheme } from "./themes.mjs";

const NOW = new Date(2026, 8, 27, 14, 0).getTime();
const DAY = 86_400_000;

function ledger() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, title, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'Breakout 101', 'done', 't', 't')").run();
  const theme = findOrCreateTheme(db, { name: "Breakout", parent: "Trading" }, NOW);
  const call = (fields) => recordApiCall(db, { provider: "deepseek", model: "deepseek-v4-flash", tokensIn: 1000, tokensOut: 100, ...fields });
  call({ feature: "summary", videoId: "aaaaaaaaaaa", costMicrousd: 2000, at: NOW });
  call({ feature: "summary_notes", videoId: "aaaaaaaaaaa", costMicrousd: 1000, at: NOW - 1000 });
  call({ feature: "theme_sheet", themeId: theme.id, costMicrousd: 5000, at: NOW - 3 * DAY });
  recordApiCall(db, { provider: "typesafe", feature: "classify", model: "jev-1.13.0", videoId: "aaaaaaaaaaa", tokensIn: 500, tokensOut: 0, costMicrousd: 21, at: NOW });
  call({ feature: "summary", videoId: "zzzzzzzzzzz", costMicrousd: 700, at: new Date(2026, 7, 15).getTime() }); // last month, video deleted since
  return { db, theme };
}

describe("the Spend page reads", () => {
  it("sums today, this month and all time", () => {
    const { db } = ledger();
    expect(spendOverview(db, NOW)).toEqual({ todayMicrousd: 3021, monthMicrousd: 8021, allMicrousd: 8721, calls: 5 });
  });

  it("splits by provider and by feature, most expensive first", () => {
    const { db } = ledger();
    expect(spendByProvider(db)).toEqual([
      { provider: "deepseek", calls: 4, tokensIn: 4000, tokensOut: 400, costMicrousd: 8700 },
      { provider: "typesafe", calls: 1, tokensIn: 500, tokensOut: 0, costMicrousd: 21 },
    ]);
    expect(spendByFeature(db).map((r) => [r.provider, r.feature, r.calls, r.costMicrousd])).toEqual([
      ["deepseek", "theme_sheet", 1, 5000],
      ["deepseek", "summary", 2, 2700],
      ["deepseek", "summary_notes", 1, 1000],
      ["typesafe", "classify", 1, 21],
    ]);
  });

  it("gives one bar per local day, empty days included", () => {
    const { db } = ledger();
    const days = spendByDay(db, NOW, 30);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toEqual({ day: "2026-09-27", costMicrousd: 3021 });
    expect(days.at(-4)).toEqual({ day: "2026-09-24", costMicrousd: 5000 });
    expect(days.at(-2)).toEqual({ day: "2026-09-26", costMicrousd: 0 });
    expect(days[0].day).toBe("2026-08-29");
  });

  it("ranks the videos and the theme sheets that cost the most", () => {
    const { db, theme } = ledger();
    expect(topVideos(db)).toEqual([
      { videoId: "aaaaaaaaaaa", title: "Breakout 101", calls: 3, costMicrousd: 3021 },
      { videoId: "zzzzzzzzzzz", title: null, calls: 1, costMicrousd: 700 },
    ]);
    expect(topThemes(db)).toEqual([{ themeId: theme.id, path: "Trading › Breakout", calls: 1, costMicrousd: 5000 }]);
  });

  it("lists the latest calls with what they were for", () => {
    const { db, theme } = ledger();
    const calls = recentCalls(db, 3);
    expect(calls.map((c) => c.feature)).toEqual(["summary", "classify", "theme_sheet"]);
    expect(calls[0]).toMatchObject({ provider: "deepseek", videoId: "zzzzzzzzzzz", videoTitle: null, costMicrousd: 700 });
    expect(calls[2]).toMatchObject({ themeId: theme.id, themePath: "Trading › Breakout" });
  });
});

describe("reconcileDeepseek — the real balance against our estimate", () => {
  it("takes the first balance as the starting point, then compares the real spend with the recorded one", () => {
    const { db } = ledger();
    const start = reconcileDeepseek(db, { currency: "USD", totalMicro: 10_000_000 }, NOW);
    expect(start).toEqual({ currency: "USD", sinceMs: NOW, realMicro: 0, estimatedMicrousd: 0, started: true });
    expect(getSetting(db, "deepseekBalanceBaseline")).toEqual({ currency: "USD", totalMicro: 10_000_000, atMs: NOW });
    recordApiCall(db, { provider: "deepseek", feature: "summary", costMicrousd: 4000, at: NOW + 1000 });
    recordApiCall(db, { provider: "typesafe", feature: "classify", costMicrousd: 42, at: NOW + 1000 });
    expect(reconcileDeepseek(db, { currency: "USD", totalMicro: 9_995_500 }, NOW + 2000)).toEqual({
      currency: "USD", sinceMs: NOW, realMicro: 4500, estimatedMicrousd: 4000, started: false,
    });
  });

  it("starts over after a top-up or a currency change", () => {
    const { db } = ledger();
    reconcileDeepseek(db, { currency: "USD", totalMicro: 1_000_000 }, NOW);
    expect(reconcileDeepseek(db, { currency: "USD", totalMicro: 6_000_000 }, NOW + 10)).toMatchObject({ started: true, sinceMs: NOW + 10 });
    expect(reconcileDeepseek(db, { currency: "CNY", totalMicro: 6_000_000 }, NOW + 20)).toMatchObject({ started: true, currency: "CNY" });
  });
});
