"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@/lib/costs.mjs";
import { getDb } from "@/lib/db.mjs";
import { DEEPSEEK_MODELS } from "@/lib/llm/models.mjs";
import { writeSettings } from "@/lib/settings.mjs";

const SettingsForm = z.object({
  deepseekModel: z.enum(DEEPSEEK_MODELS),
  thresholdPercent: z.coerce.number().int().min(0).max(100),
});

// The monthly budget field: empty = no budget; otherwise dollars, e.g. "5" or "12.50" (a "$" is allowed).
function budgetFrom(value) {
  const text = String(value ?? "").trim().replace(/^\$\s*/, "");
  if (!text) return { ok: true, micro: null };
  const micro = parseAmount(text);
  return micro && micro > 0 ? { ok: true, micro } : { ok: false };
}

export async function saveSettingsAction(_prev, formData) {
  const parsed = SettingsForm.safeParse({ deepseekModel: formData.get("deepseekModel"), thresholdPercent: formData.get("thresholdPercent") });
  if (!parsed.success) return { ok: false, error: "The threshold is a whole percentage between 0 and 100." };
  const budget = budgetFrom(formData.get("monthlyBudget"));
  if (!budget.ok) return { ok: false, error: "The budget is an amount in dollars, like 5 or 12.50 — leave it empty for no budget." };
  try {
    writeSettings(getDb(), {
      deepseekModel: parsed.data.deepseekModel,
      jevThresholdPermille: parsed.data.thresholdPercent * 10,
      monthlyBudgetMicrousd: budget.micro,
    });
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) };
  }
  revalidatePath("/", "layout"); // the budget banners live on several pages
  return { ok: true };
}
