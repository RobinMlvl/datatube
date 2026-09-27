// What the API calls cost, read for the Spend page. Every amount is integer micro-USD.
import { getSetting, setSetting } from "./settings.mjs";
import { themePath, themesById } from "./themes.mjs";
import { iso, localDayKey, startOfLocalDay, startOfLocalMonth } from "./time.mjs";

export function spendOverview(db, now) {
  return db.prepare(`SELECT COALESCE(SUM(CASE WHEN createdAt >= @day THEN costMicrousd END), 0) AS todayMicrousd,
                            COALESCE(SUM(CASE WHEN createdAt >= @month THEN costMicrousd END), 0) AS monthMicrousd,
                            COALESCE(SUM(costMicrousd), 0) AS allMicrousd,
                            COUNT(*) AS calls
                     FROM ApiCall`).get({ day: iso(startOfLocalDay(now)), month: iso(startOfLocalMonth(now)) });
}

export function spendByProvider(db) {
  return db.prepare(`SELECT provider, COUNT(*) AS calls, COALESCE(SUM(tokensIn), 0) AS tokensIn, COALESCE(SUM(tokensOut), 0) AS tokensOut,
                            SUM(costMicrousd) AS costMicrousd
                     FROM ApiCall GROUP BY provider ORDER BY costMicrousd DESC, provider`).all();
}

export function spendByFeature(db) {
  return db.prepare(`SELECT provider, feature, COUNT(*) AS calls, SUM(costMicrousd) AS costMicrousd
                     FROM ApiCall GROUP BY provider, feature ORDER BY costMicrousd DESC, provider, feature`).all();
}

// One bar per local day, the last `days` days ending today, empty days included.
export function spendByDay(db, now, days = 30) {
  const today = new Date(startOfLocalDay(now));
  const keys = Array.from({ length: days }, (_, i) =>
    localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1) + i).getTime()));
  const totals = new Map(keys.map((k) => [k, 0]));
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)).getTime();
  for (const row of db.prepare("SELECT createdAt, costMicrousd FROM ApiCall WHERE createdAt >= ?").all(iso(first))) {
    const key = localDayKey(Date.parse(row.createdAt));
    if (totals.has(key)) totals.set(key, totals.get(key) + row.costMicrousd);
  }
  return keys.map((day) => ({ day, costMicrousd: totals.get(day) }));
}

export function topVideos(db, limit = 10) {
  return db.prepare(`SELECT a.videoId, v.title, COUNT(*) AS calls, SUM(a.costMicrousd) AS costMicrousd
                     FROM ApiCall a LEFT JOIN Video v ON v.id = a.videoId
                     WHERE a.videoId IS NOT NULL
                     GROUP BY a.videoId ORDER BY costMicrousd DESC, a.videoId LIMIT ?`).all(limit);
}

// Theme sheets are the calls filed under a theme; a deleted theme keeps its cost, with no path.
export function topThemes(db, limit = 10) {
  const byId = themesById(db);
  return db.prepare(`SELECT themeId, COUNT(*) AS calls, SUM(costMicrousd) AS costMicrousd
                     FROM ApiCall WHERE themeId IS NOT NULL
                     GROUP BY themeId ORDER BY costMicrousd DESC, themeId LIMIT ?`).all(limit)
    .map((r) => ({ themeId: r.themeId, path: byId.has(r.themeId) ? themePath(byId.get(r.themeId), byId) : null, calls: r.calls, costMicrousd: r.costMicrousd }));
}

export function recentCalls(db, limit = 50) {
  const byId = themesById(db);
  return db.prepare(`SELECT a.*, v.title AS videoTitle FROM ApiCall a LEFT JOIN Video v ON v.id = a.videoId
                     ORDER BY a.id DESC LIMIT ?`).all(limit)
    .map((c) => ({ ...c, themePath: c.themeId != null && byId.has(c.themeId) ? themePath(byId.get(c.themeId), byId) : null }));
}

// The real DeepSeek balance against what DataTube recorded. The first balance seen is the starting
// point; the real spend is how much it went down since. A top-up (the balance went up) or another
// currency starts the comparison over. Calls at the very instant of a reading count as before it.
export function reconcileDeepseek(db, { currency, totalMicro }, now) {
  const base = getSetting(db, "deepseekBalanceBaseline");
  if (!base || base.currency !== currency || !Number.isSafeInteger(base.totalMicro) || totalMicro > base.totalMicro) {
    setSetting(db, "deepseekBalanceBaseline", { currency, totalMicro, atMs: now });
    return { currency, sinceMs: now, realMicro: 0, estimatedMicrousd: 0, started: true };
  }
  const estimatedMicrousd = db.prepare("SELECT COALESCE(SUM(costMicrousd), 0) FROM ApiCall WHERE provider = 'deepseek' AND createdAt > ?")
    .pluck().get(iso(base.atMs));
  return { currency, sinceMs: base.atMs, realMicro: base.totalMicro - totalMicro, estimatedMicrousd, started: false };
}
