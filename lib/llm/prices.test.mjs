import { describe, expect, it } from "vitest";
import { costMicrousd, isDeepseekPeak } from "./prices.mjs";

const TUE_PEAK = new Date("2026-09-15T02:00:00Z");
const TUE_OFF = new Date("2026-09-15T12:00:00Z");
const SAT = new Date("2026-09-19T02:00:00Z");

describe("DeepSeek bills by the clock", () => {
  it("knows peak hours: weekdays 01-04 and 06-10 UTC", () => {
    expect(isDeepseekPeak(TUE_PEAK)).toBe(true);
    expect(isDeepseekPeak(new Date("2026-09-15T09:59:00Z"))).toBe(true);
    expect(isDeepseekPeak(new Date("2026-09-15T10:00:00Z"))).toBe(false);
    expect(isDeepseekPeak(TUE_OFF)).toBe(false);
    expect(isDeepseekPeak(SAT)).toBe(false);
  });

  it("prices a call in integer micro-USD, one rounding on the total", () => {
    // off-peak: 10 000 miss × 0.15 + 2 000 hit × 0.003 + 1 000 out × 0.60 = 1 500 + 6 + 600 = 2 106 µ$
    expect(costMicrousd("deepseek-v4-flash", { missTokens: 10_000, hitTokens: 2_000, outTokens: 1_000 }, TUE_OFF)).toBe(2106);
    expect(costMicrousd("deepseek-v4-flash", { missTokens: 10_000, hitTokens: 2_000, outTokens: 1_000 }, TUE_PEAK)).toBe(4212);
    // 1 token off-peak = 0.15 µ$ → rounds to 0, but 4 tokens = 0.6 → 1: the total is rounded, never each term
    expect(costMicrousd("deepseek-v4-flash", { missTokens: 4 }, TUE_OFF)).toBe(1);
  });

  it("prices Jev on input only", () => {
    expect(costMicrousd("jev-1.13.0", { missTokens: 100_000, outTokens: 50_000 }, TUE_PEAK)).toBe(4200);
  });

  it("refuses a model it has no price for", () => {
    expect(() => costMicrousd("gpt-9", { missTokens: 1 }, TUE_OFF)).toThrow(/No price/);
  });
});
