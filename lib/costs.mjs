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
