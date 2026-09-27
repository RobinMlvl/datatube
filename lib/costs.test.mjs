import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { costTotals, formatUsd, recordApiCall } from "./costs.mjs";

const AT = Date.parse("2026-09-27T10:00:00.000Z");

describe("the cost ledger", () => {
  it("records a call and sums in integers", () => {
    const db = openDb(":memory:");
    recordApiCall(db, { provider: "deepseek", feature: "summary", model: "deepseek-v4-flash", tokensIn: 10, tokensOut: 5, costMicrousd: 2106, at: AT });
    recordApiCall(db, { provider: "typesafe", feature: "classify", model: "jev-1.13.0", costMicrousd: 42, at: AT - 40 * 86_400_000 });
    expect(costTotals(db, { sinceIso: "2026-09-01T00:00:00.000Z" })).toEqual({ allMicrousd: 2148, sinceMicrousd: 2106 });
  });

  it("refuses a cost that is not a non-negative integer", () => {
    const db = openDb(":memory:");
    expect(() => recordApiCall(db, { provider: "deepseek", feature: "x", costMicrousd: 1.5, at: AT })).toThrow();
    expect(() => recordApiCall(db, { provider: "deepseek", feature: "x", costMicrousd: -1, at: AT })).toThrow();
  });

  it("formats dollars by truncating, and says when a spend is under a cent", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(2106)).toBe("< $0.01");
    expect(formatUsd(1_239_999)).toBe("$1.23");
    expect(formatUsd(null)).toBe("—");
  });
});
