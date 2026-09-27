// The monthly budget: a soft cap, checked before each paid step (a step already running may end
// a little over it). Reached, the worker takes only the free YouTube steps until the next month.
import { costTotals } from "./costs.mjs";
import { readSettings } from "./settings.mjs";
import { iso, startOfLocalMonth, startOfNextLocalMonth } from "./time.mjs";

export const BUDGET_WARNING_PERMILLE = 800;

export function budgetStatus(db, now) {
  const { monthlyBudgetMicrousd: budget } = readSettings(db);
  const spent = costTotals(db, { sinceIso: iso(startOfLocalMonth(now)) }).sinceMicrousd;
  const resetsAt = startOfNextLocalMonth(now);
  if (budget == null) return { level: "none", budgetMicrousd: null, spentMicrousd: spent, usedPermille: null, resetsAt };
  const usedPermille = Number((BigInt(spent) * 1000n) / BigInt(budget));
  const level = spent >= budget ? "reached" : usedPermille >= BUDGET_WARNING_PERMILLE ? "warning" : "ok";
  return { level, budgetMicrousd: budget, spentMicrousd: spent, usedPermille, resetsAt };
}

export const paidStepsAllowed = (db, now) => budgetStatus(db, now).level !== "reached";
