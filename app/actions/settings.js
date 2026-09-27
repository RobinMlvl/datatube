"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db.mjs";
import { DEEPSEEK_MODELS } from "@/lib/llm/models.mjs";
import { writeSettings } from "@/lib/settings.mjs";

const SettingsForm = z.object({
  deepseekModel: z.enum(DEEPSEEK_MODELS),
  thresholdPercent: z.coerce.number().int().min(0).max(100),
});

export async function saveSettingsAction(_prev, formData) {
  const parsed = SettingsForm.safeParse({ deepseekModel: formData.get("deepseekModel"), thresholdPercent: formData.get("thresholdPercent") });
  if (!parsed.success) return { ok: false, error: "The threshold is a whole percentage between 0 and 100." };
  writeSettings(getDb(), { deepseekModel: parsed.data.deepseekModel, jevThresholdPermille: parsed.data.thresholdPercent * 10 });
  revalidatePath("/settings");
  return { ok: true };
}
