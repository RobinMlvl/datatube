import { describe, expect, it, vi } from "vitest";
import { createDeepseek, fetchDeepseekBalance } from "./deepseek.mjs";

const NOW = () => new Date("2026-09-15T12:00:00Z"); // off-peak
const ok = (content, usage = { prompt_tokens: 12_000, prompt_cache_hit_tokens: 2_000, prompt_cache_miss_tokens: 10_000, completion_tokens: 1_000 }, finish = "stop") => ({
  status: 200, ok: true, json: async () => ({ choices: [{ message: { content }, finish_reason: finish }], usage }),
});
const status = (code) => ({ status: code, ok: false, json: async () => ({ error: { message: "nope" } }) });

function client(fetchImpl, record = vi.fn()) {
  return { record, complete: createDeepseek({ apiKey: "k", fetchImpl, now: NOW, sleep: async () => {}, record }) };
}

describe("the DeepSeek client", () => {
  it("sends a chat completion with thinking disabled, and records its exact cost", async () => {
    const fetchImpl = vi.fn(async () => ok("## 🎯 Core idea\n…"));
    const { complete, record } = client(fetchImpl);
    const out = await complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "summary", videoId: "dQw4w9WgXcQ" });
    expect(out.text).toContain("Core idea");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "deepseek-v4-flash", thinking: { type: "disabled" }, messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }] });
    expect(body.response_format).toBeUndefined();
    expect(record).toHaveBeenCalledWith({ provider: "deepseek", feature: "summary", model: "deepseek-v4-flash", videoId: "dQw4w9WgXcQ", themeId: null, tokensIn: 12_000, tokensOut: 1_000, costMicrousd: 2106 });
  });

  it("leaves room for a long video's exhaustive notes: 32 000 output tokens unless told otherwise", async () => {
    const fetchImpl = vi.fn(async () => ok("notes"));
    await client(fetchImpl).complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "summary_notes" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).max_tokens).toBe(32_000);
  });

  it("asks for JSON when told to", async () => {
    const fetchImpl = vi.fn(async () => ok('{"name":"Breakout"}'));
    await client(fetchImpl).complete({ model: "deepseek-v4-flash", system: "S", user: "U", json: true, feature: "theme_proposal" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).response_format).toEqual({ type: "json_object" });
  });

  it("retries a 429 or a 5xx, then succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok("fine"));
    expect((await client(fetchImpl).complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "f" })).text).toBe("fine");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 4xx, and names it", async () => {
    const fetchImpl = vi.fn(async () => status(400));
    await expect(client(fetchImpl).complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "f" })).rejects.toMatchObject({ code: "bad_request" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("records a truncated answer's cost, then refuses it", async () => {
    const { complete, record } = client(vi.fn(async () => ok("half", undefined, "length")));
    await expect(complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "f" })).rejects.toMatchObject({ code: "truncated" });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("refuses to run without a key", async () => {
    const complete = createDeepseek({ apiKey: "", fetchImpl: vi.fn(), now: NOW, record: vi.fn() });
    await expect(complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "f" })).rejects.toMatchObject({ code: "no_key" });
  });

  it("never repeats its key in an error", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 401, ok: false, json: async () => ({ error: { message: "invalid key sk-secret-123" } }) }));
    const complete = createDeepseek({ apiKey: "sk-secret-123", fetchImpl, now: NOW, sleep: async () => {}, record: vi.fn() });
    const err = await complete({ model: "deepseek-v4-flash", system: "S", user: "U", feature: "f" }).catch((e) => e);
    expect(err.code).toBe("bad_request");
    expect(err.message).not.toContain("sk-secret-123");
  });

  it("reads the account balance in integer micro-units", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ is_available: true, balance_infos: [{ currency: "USD", total_balance: "12.34", granted_balance: "0.00", topped_up_balance: "12.34" }] }) }));
    expect(await fetchDeepseekBalance({ apiKey: "k", fetchImpl })).toEqual({ available: true, balances: [{ currency: "USD", totalMicro: 12_340_000 }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/user/balance");
    expect(init.headers.Authorization).toBe("Bearer k");
  });

  it("refuses to read the balance without a key, and never repeats the key", async () => {
    await expect(fetchDeepseekBalance({ apiKey: "", fetchImpl: vi.fn() })).rejects.toMatchObject({ code: "no_key" });
    const fetchImpl = vi.fn(async () => ({ status: 401, ok: false, json: async () => ({ error: { message: "bad sk-secret-123" } }) }));
    const err = await fetchDeepseekBalance({ apiKey: "sk-secret-123", fetchImpl }).catch((e) => e);
    expect(err.code).toBe("bad_request");
    expect(err.message).not.toContain("sk-secret-123");
  });
});
