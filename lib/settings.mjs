// Operator settings, stored as JSON per key. A value that is missing or out of contract reads as
// the default — never as a minimum (Number(null) is 0).
import { DEEPSEEK_MODELS } from "./llm/models.mjs";

export const SETTING_DEFAULTS = Object.freeze({
  deepseekModel: "deepseek-v4-flash",
  jevThresholdPermille: 600,
});

const isThreshold = (v) => Number.isInteger(v) && v >= 0 && v <= 1000;
const isModel = (v) => typeof v === "string" && DEEPSEEK_MODELS.includes(v);

export function getSetting(db, key) {
  const row = db.prepare("SELECT value FROM Setting WHERE key = ?").get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

export function setSetting(db, key, value) {
  db.prepare("INSERT INTO Setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

export function readSettings(db) {
  const model = getSetting(db, "deepseekModel");
  const threshold = getSetting(db, "jevThresholdPermille");
  return {
    deepseekModel: isModel(model) ? model : SETTING_DEFAULTS.deepseekModel,
    jevThresholdPermille: isThreshold(threshold) ? threshold : SETTING_DEFAULTS.jevThresholdPermille,
  };
}

export function writeSettings(db, partial) {
  if ("deepseekModel" in partial && !isModel(partial.deepseekModel)) throw new Error("Unknown DeepSeek model.");
  if ("jevThresholdPermille" in partial && !isThreshold(partial.jevThresholdPermille)) throw new Error("The threshold must be between 0 and 1000.");
  for (const [key, value] of Object.entries(partial)) setSetting(db, key, value);
}
