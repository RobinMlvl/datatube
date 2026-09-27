// The cost ledger: one ApiCall row per paid call, integer micro-USD.
import { iso } from "./time.mjs";

export function recordApiCall(db, { provider, feature, model = null, videoId = null, themeId = null, tokensIn = null, tokensOut = null, costMicrousd, at }) {
  if (!Number.isSafeInteger(costMicrousd) || costMicrousd < 0) throw new Error("costMicrousd must be a non-negative integer");
  db.prepare(`INSERT INTO ApiCall (provider, feature, model, videoId, themeId, tokensIn, tokensOut, costMicrousd, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(provider, feature, model, videoId, themeId, tokensIn, tokensOut, costMicrousd, iso(at));
}

export function costTotals(db, { sinceIso }) {
  const row = db.prepare(`SELECT COALESCE(SUM(costMicrousd), 0) AS allMicrousd,
                                 COALESCE(SUM(CASE WHEN createdAt >= ? THEN costMicrousd END), 0) AS sinceMicrousd
                          FROM ApiCall`).get(sinceIso);
  return { allMicrousd: row.allMicrousd, sinceMicrousd: row.sinceMicrousd };
}

// Truncated, never rounded up: a spend is never shown larger than it was.
export function formatUsd(micro) {
  if (micro === null || micro === undefined) return "—";
  const m = BigInt(micro);
  const cents = m / 10_000n;
  if (m > 0n && cents === 0n) return "< $0.01";
  return `$${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

// Four decimals, still truncated — for per-call amounts, where "< $0.01" says nothing.
export function formatUsdPrecise(micro) {
  if (micro === null || micro === undefined) return "—";
  const units = BigInt(micro) / 100n; // ten-thousandths of a dollar
  return `$${units / 10_000n}.${String(units % 10_000n).padStart(4, "0")}`;
}

// "12.50" → 12 500 000 micro-units, by string arithmetic (never a float); beyond 6 decimals is cut.
export function parseAmount(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,9})(?:\.(\d{1,6})\d*)?$/);
  if (!m) return null;
  return Number(BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0")));
}

// What one worker job spent: the calls recorded for its video after a mark taken before it ran.
export const lastApiCallId = (db) => db.prepare("SELECT COALESCE(MAX(id), 0) FROM ApiCall").pluck().get();
export const costSince = (db, afterId, videoId) =>
  db.prepare("SELECT COALESCE(SUM(costMicrousd), 0) FROM ApiCall WHERE id > ? AND videoId = ?").pluck().get(afterId, videoId);
