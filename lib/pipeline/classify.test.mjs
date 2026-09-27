import { describe, expect, it, vi } from "vitest";
import { openDb } from "../db.mjs";
import { findOrCreateTheme } from "../themes.mjs";
import { applyClassification, buildThemeQuestion, classifyState, classifyVideo, decideTheme, parseProposal } from "./classify.mjs";

const NOW = Date.parse("2026-09-27T10:00:00.000Z");
const SUMMARY = "# T\nmeta\n\n## 📝 Summary\nTrade range breakouts.\n## 🎯 Key takeaways\n- Stop under the range.\n## 🛠️ Method\nNot in the video";
const VIDEO = { id: "aaaaaaaaaaa", title: "Breakout 101", channel: "Trader Joe" };
function seeded() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, title, channel, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'Breakout 101', 'Trader Joe', 'classifying', 't', 't')").run();
  return db;
}
const choice = (key, p) => ({ theme: { type: "choice", choice: key, probabilities: { [key]: p }, confidence: p } });

describe("the question Jev answers", () => {
  it("sends the title, the channel and the core of the sheet — not the whole transcript", () => {
    expect(classifyState(VIDEO, SUMMARY)).toEqual({
      video: { title: "Breakout 101", channel: "Trader Joe" },
      summary: "Trade range breakouts.\n\n- Stop under the range.",
    });
  });

  it("offers every theme by its path, with a few of its titles, and a way out", () => {
    const q = buildThemeQuestion([{ id: 1, name: "Trading", parentId: null }, { id: 2, name: "Breakout", parentId: 1 }], new Map([[2, ["Breakout 101"]]]));
    expect(q.theme.type).toBe("choice");
    expect(q.theme.criteria).toEqual({
      t1: 'The theme "Trading".',
      t2: 'The theme "Trading › Breakout". Videos already in it: "Breakout 101".',
      none: "None of the themes above fits the main subject of the video.",
    });
  });
});

describe("decideTheme", () => {
  it("files the video when Jev is sure enough", () => {
    expect(decideTheme({ choice: "t2", p: 0.61 }, { thresholdPermille: 600 })).toEqual({ themeId: 2, confidencePermille: 610 });
  });

  it("does not file it under the threshold, on « none », or without an answer", () => {
    expect(decideTheme({ choice: "t2", p: 0.59 }, { thresholdPermille: 600 })).toEqual({ themeId: null, confidencePermille: 590 });
    expect(decideTheme({ choice: "none", p: 0.9 }, { thresholdPermille: 600 })).toEqual({ themeId: null, confidencePermille: 900 });
    expect(decideTheme(null, { thresholdPermille: 600 })).toEqual({ themeId: null, confidencePermille: null });
  });
});

describe("parseProposal", () => {
  it("reads DeepSeek's JSON and drops a parent equal to the name", () => {
    expect(parseProposal('{"name":"Breakout Strategy","parent":"Trading"}')).toEqual({ name: "Breakout Strategy", parent: "Trading" });
    expect(parseProposal('{"name":"Trading","parent":"trading"}')).toEqual({ name: "Trading", parent: null });
  });

  it("refuses what is not a usable proposal", () => {
    expect(() => parseProposal("Trading")).toThrow(/not JSON/);
    expect(() => parseProposal('{"name":""}')).toThrow(/no usable name/);
  });
});

describe("classifyVideo", () => {
  it("lets Jev file the video in an existing theme", async () => {
    const db = seeded();
    const t = findOrCreateTheme(db, { name: "Breakout", parent: "Trading" }, NOW);
    const jev = vi.fn(async () => choice(`t${t.id}`, 0.8));
    const complete = vi.fn();
    const result = await classifyVideo({ db, video: VIDEO, summary: SUMMARY, model: "m", thresholdPermille: 600, jev, complete });
    expect(result).toEqual({ kind: "auto", themeId: t.id, confidencePermille: 800 });
    expect(complete).not.toHaveBeenCalled();
    expect(jev.mock.calls[0][0].feature).toBe("classify");
  });

  it("asks DeepSeek for a theme when Jev is unsure, and sends it to Review", async () => {
    const db = seeded();
    findOrCreateTheme(db, { name: "Cooking" }, NOW);
    const jev = vi.fn(async () => choice("none", 0.7));
    const complete = vi.fn(async () => ({ text: '{"name":"Breakout Strategy","parent":"Trading"}' }));
    const result = await classifyVideo({ db, video: VIDEO, summary: SUMMARY, model: "m", thresholdPermille: 600, jev, complete });
    expect(result).toEqual({ kind: "proposed", proposal: { name: "Breakout Strategy", parent: "Trading" }, confidencePermille: 700 });
    expect(complete.mock.calls[0][0]).toMatchObject({ json: true, feature: "theme_proposal" });
    expect(complete.mock.calls[0][0].user).toContain("- Cooking");
  });

  it("skips Jev when there is no theme yet", async () => {
    const db = seeded();
    const jev = vi.fn();
    const complete = vi.fn(async () => ({ text: '{"name":"Trading","parent":null}' }));
    const result = await classifyVideo({ db, video: VIDEO, summary: SUMMARY, model: "m", thresholdPermille: 600, jev, complete });
    expect(jev).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "proposed", proposal: { name: "Trading", parent: null }, confidencePermille: null });
  });

  it("files the video directly when DeepSeek names a theme that already exists", async () => {
    const db = seeded();
    const t = findOrCreateTheme(db, { name: "Breakout Strategy", parent: "Trading" }, NOW);
    const result = await classifyVideo({
      db, video: VIDEO, summary: SUMMARY, model: "m", thresholdPermille: 600,
      jev: vi.fn(async () => choice("none", 0.5)),
      complete: vi.fn(async () => ({ text: '{"name":"breakout strategy","parent":"TRADING"}' })),
    });
    expect(result).toEqual({ kind: "auto", themeId: t.id, confidencePermille: 500 });
  });
});

describe("applyClassification", () => {
  it("files an auto result, or parks a proposal for Review", () => {
    const db = seeded();
    const t = findOrCreateTheme(db, { name: "Trading" }, NOW);
    applyClassification(db, "aaaaaaaaaaa", { kind: "auto", themeId: t.id, confidencePermille: 800 }, NOW);
    expect(db.prepare("SELECT themeId, themeSource, classifyConfidence FROM Video").get()).toEqual({ themeId: t.id, themeSource: "auto", classifyConfidence: 800 });
    applyClassification(db, "aaaaaaaaaaa", { kind: "proposed", proposal: { name: "Scalping", parent: "Trading" }, confidencePermille: 300 }, NOW);
    expect(db.prepare("SELECT themeId, themeSource, proposedTheme, classifyConfidence FROM Video").get()).toEqual({
      themeId: null, themeSource: "proposed", proposedTheme: '{"name":"Scalping","parent":"Trading"}', classifyConfidence: 300,
    });
    expect(db.prepare("SELECT changesSinceSheet FROM Theme WHERE id = ?").pluck().get(t.id)).toBe(2);
  });
});
