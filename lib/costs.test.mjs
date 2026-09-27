import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { costSince, costTotals, formatAmount, formatUsd, formatUsdPrecise, lastApiCallId, parseAmount, recordApiCall } from "./costs.mjs";

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

  it("shows per-call amounts to four decimals, still truncated", () => {
    expect(formatUsdPrecise(4212)).toBe("$0.0042");
    expect(formatUsdPrecise(1_239_999)).toBe("$1.2399");
    expect(formatUsdPrecise(0)).toBe("$0.0000");
    expect(formatUsdPrecise(null)).toBe("—");
    expect(formatUsdPrecise(-1250)).toBe("-$0.0012"); // a gap between real and recorded spend can go either way
  });

  it("writes an amount back as a plain exact decimal, for a form field or another currency", () => {
    expect(formatAmount(12_500_000)).toBe("12.5");
    expect(formatAmount(5_000_000)).toBe("5");
    expect(formatAmount(110_004_599)).toBe("110.004599");
    expect(formatAmount(-1_500_000)).toBe("-1.5");
    expect(formatAmount(null)).toBe("");
    expect(parseAmount(formatAmount(1_234_567))).toBe(1_234_567);
  });

  it("reads a decimal amount into integer micro-units, without floats", () => {
    expect(parseAmount("12.50")).toBe(12_500_000);
    expect(parseAmount("5")).toBe(5_000_000);
    expect(parseAmount("110.004599")).toBe(110_004_599);
    expect(parseAmount("0.1234567")).toBe(123_456); // beyond a micro-unit: truncated
    for (const bad of ["", "abc", "-1", "1,5", "1.", null]) expect(parseAmount(bad)).toBeNull();
  });

  it("tells what a job spent on its video", () => {
    const db = openDb(":memory:");
    recordApiCall(db, { provider: "deepseek", feature: "summary", videoId: "aaaaaaaaaaa", costMicrousd: 10, at: AT });
    const mark = lastApiCallId(db);
    recordApiCall(db, { provider: "deepseek", feature: "summary", videoId: "aaaaaaaaaaa", costMicrousd: 2106, at: AT });
    recordApiCall(db, { provider: "deepseek", feature: "theme_sheet", themeId: 1, costMicrousd: 999, at: AT });
    expect(costSince(db, mark, "aaaaaaaaaaa")).toBe(2106);
    expect(costSince(db, lastApiCallId(db), "aaaaaaaaaaa")).toBe(0);
  });
});
