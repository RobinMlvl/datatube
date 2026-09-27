import { describe, expect, it } from "vitest";
import { budgetStatus, paidStepsAllowed } from "./budget.mjs";
import { recordApiCall } from "./costs.mjs";
import { openDb } from "./db.mjs";
import { writeSettings } from "./settings.mjs";

const NOW = new Date(2026, 8, 27, 14, 0).getTime();
const LAST_MONTH = new Date(2026, 7, 30, 12, 0).getTime();
const spend = (db, costMicrousd, at = NOW) => recordApiCall(db, { provider: "deepseek", feature: "summary", costMicrousd, at });

describe("the monthly budget", () => {
  it("has no level without a budget, and never blocks", () => {
    const db = openDb(":memory:");
    spend(db, 9_000_000);
    expect(budgetStatus(db, NOW)).toMatchObject({ level: "none", budgetMicrousd: null, spentMicrousd: 9_000_000, usedPermille: null });
    expect(paidStepsAllowed(db, NOW)).toBe(true);
  });

  it("counts this month only, warns from 80 % and blocks paid steps at 100 %", () => {
    const db = openDb(":memory:");
    writeSettings(db, { monthlyBudgetMicrousd: 5_000_000 });
    spend(db, 4_000_000, LAST_MONTH);
    spend(db, 3_999_999);
    expect(budgetStatus(db, NOW)).toMatchObject({ level: "ok", spentMicrousd: 3_999_999, usedPermille: 799 });
    spend(db, 1);
    expect(budgetStatus(db, NOW)).toMatchObject({ level: "warning", usedPermille: 800 });
    expect(paidStepsAllowed(db, NOW)).toBe(true);
    spend(db, 1_000_000);
    expect(budgetStatus(db, NOW)).toMatchObject({ level: "reached", spentMicrousd: 5_000_000, usedPermille: 1000, resetsAt: new Date(2026, 9, 1).getTime() });
    expect(paidStepsAllowed(db, NOW)).toBe(false);
  });
});
