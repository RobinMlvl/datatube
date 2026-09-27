import { describe, expect, it, vi } from "vitest";
import { choiceOf, createJev } from "./jev.mjs";

const NOW = () => new Date("2026-09-15T12:00:00Z");
const reply = (body, code = 200, headers = {}) => ({ status: code, ok: code < 300, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => JSON.stringify(body) });
const ANSWERS = { theme: { type: "choice", choice: "t3", probabilities: { t3: 0.82, none: 0.18 }, confidence: 0.82 } };

describe("the Jev client", () => {
  it("posts the state and the questions, and records the input-only cost", async () => {
    const fetchImpl = vi.fn(async () => reply({ model: "jev-1.13.0", answers: ANSWERS, usage: { input_tokens: 100_000, output_tokens: 7 } }));
    const record = vi.fn();
    const ask = createJev({ apiKey: "k", fetchImpl, now: NOW, sleep: async () => {}, record });
    const questions = { theme: { type: "choice", instructions: "Which?", criteria: { t3: "A", none: "B" } } };
    expect(await ask({ state: { video: { title: "x" } }, questions, feature: "classify", videoId: "dQw4w9WgXcQ" })).toEqual(ANSWERS);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(init.body)).toEqual({ model: "jev-1.13.0", state: { video: { title: "x" } }, questions });
    expect(record).toHaveBeenCalledWith({ provider: "typesafe", feature: "classify", model: "jev-1.13.0", videoId: "dQw4w9WgXcQ", themeId: null, tokensIn: 100_000, tokensOut: 7, costMicrousd: 4200 });
  });

  it("waits out a 429 and tries again", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply({}, 429, { "retry-after": "1" }))
      .mockResolvedValueOnce(reply({ answers: ANSWERS, usage: { input_tokens: 1, output_tokens: 0 } }));
    const sleep = vi.fn(async () => {});
    const ask = createJev({ apiKey: "k", fetchImpl, now: NOW, sleep, record: vi.fn() });
    await ask({ state: {}, questions: { theme: {} }, feature: "classify" });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("refuses an answer set that is not one", async () => {
    const ask = createJev({ apiKey: "k", fetchImpl: vi.fn(async () => reply({ nope: true })), now: NOW, sleep: async () => {}, record: vi.fn() });
    await expect(ask({ state: {}, questions: { theme: {} }, feature: "classify" })).rejects.toMatchObject({ code: "bad_response" });
  });
});

describe("the Jev client, defensively", () => {
  it("prices a call by the model it asked for, whatever version answers", async () => {
    const record = vi.fn();
    const ask = createJev({ apiKey: "k", fetchImpl: vi.fn(async () => reply({ model: "jev-1.14.2", answers: ANSWERS, usage: { input_tokens: 100_000, output_tokens: 7 } })), now: NOW, sleep: async () => {}, record });
    await ask({ state: {}, questions: { theme: {} }, feature: "classify" });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ model: "jev-1.14.2", costMicrousd: 4200 }));
  });

  it("never repeats its key in an error", async () => {
    const ask = createJev({ apiKey: "sk-secret-123", fetchImpl: vi.fn(async () => reply({ error: "bad key sk-secret-123" }, 401)), now: NOW, sleep: async () => {}, record: vi.fn() });
    const err = await ask({ state: {}, questions: { theme: {} }, feature: "classify" }).catch((e) => e);
    expect(err.code).toBe("bad_request");
    expect(err.message).not.toContain("sk-secret-123");
  });
});

describe("choiceOf", () => {
  it("reads the chosen option and its probability", () => {
    expect(choiceOf(ANSWERS, "theme")).toEqual({ choice: "t3", p: 0.82, confidence: 0.82, probabilities: { t3: 0.82, none: 0.18 } });
  });

  it("treats a missing or malformed answer as unknown", () => {
    expect(choiceOf({}, "theme")).toBeNull();
    expect(choiceOf({ theme: { type: "noul", noul: 0.4 } }, "theme")).toBeNull();
  });
});
