import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { SETTING_DEFAULTS, getSetting, readSettings, setSetting, writeSettings } from "./settings.mjs";

describe("settings", () => {
  it("reads the defaults when nothing is stored", () => {
    expect(readSettings(openDb(":memory:"))).toEqual(SETTING_DEFAULTS);
  });

  it("keeps a valid value and falls back on an invalid one — never a surprise minimum", () => {
    const db = openDb(":memory:");
    writeSettings(db, { jevThresholdPermille: 750 });
    expect(readSettings(db).jevThresholdPermille).toBe(750);
    setSetting(db, "jevThresholdPermille", null); // Number(null) would be 0: it must not be
    expect(readSettings(db).jevThresholdPermille).toBe(SETTING_DEFAULTS.jevThresholdPermille);
    setSetting(db, "deepseekModel", "gpt-9");
    expect(readSettings(db).deepseekModel).toBe(SETTING_DEFAULTS.deepseekModel);
  });

  it("refuses to write an out-of-range threshold or an unknown model", () => {
    const db = openDb(":memory:");
    expect(() => writeSettings(db, { jevThresholdPermille: 1001 })).toThrow();
    expect(() => writeSettings(db, { deepseekModel: "gpt-9" })).toThrow();
  });

  it("stores any JSON value under a key", () => {
    const db = openDb(":memory:");
    setSetting(db, "queuePausedUntil", 1_790_000_000_000);
    expect(getSetting(db, "queuePausedUntil")).toBe(1_790_000_000_000);
    expect(getSetting(db, "missing")).toBeNull();
  });

  it("keeps an optional monthly budget in integer micro-USD", () => {
    const db = openDb(":memory:");
    expect(readSettings(db).monthlyBudgetMicrousd).toBeNull();
    writeSettings(db, { monthlyBudgetMicrousd: 5_000_000 });
    expect(readSettings(db).monthlyBudgetMicrousd).toBe(5_000_000);
    writeSettings(db, { monthlyBudgetMicrousd: null });
    expect(readSettings(db).monthlyBudgetMicrousd).toBeNull();
    for (const bad of [0, -1, 1.5, "5"]) expect(() => writeSettings(db, { monthlyBudgetMicrousd: bad })).toThrow();
    setSetting(db, "monthlyBudgetMicrousd", 2.5);
    expect(readSettings(db).monthlyBudgetMicrousd).toBeNull(); // out of contract reads as no budget, never as 0
  });
});
