// DeepSeek writes: the video sheets, the theme sheets, the name of a new theme.
import { parseAmount } from "../costs.mjs";
import { LlmError } from "./errors.mjs";
import { costMicrousd } from "./prices.mjs";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const BALANCE_ENDPOINT = "https://api.deepseek.com/user/balance";
const RETRIES = 3;
const defaultFetch = (...args) => globalThis.fetch(...args);

// Error text reaches the database, the worker log and the page: never let it carry the key.
const redactKey = (text, key) => String(text).split(key).join("***");

export function createDeepseek({
  apiKey = process.env.DEEPSEEK_API_KEY,
  fetchImpl = defaultFetch,
  now = () => new Date(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  record,
} = {}) {
  return async function complete({ model, system, user, json = false, maxTokens = 8000, feature, videoId = null, themeId = null, timeoutMs = 300_000 }) {
    if (!apiKey?.trim()) throw new LlmError("DEEPSEEK_API_KEY is missing in .env.local", "no_key");
    const redact = (text) => redactKey(text, apiKey.trim());
    const body = JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      // V4 thinks by default and its reasoning eats max_tokens: every task here is direct writing.
      thinking: { type: "disabled" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (attempt < RETRIES) { await sleep(1000 * 2 ** attempt); continue; }
        throw new LlmError(redact(`DeepSeek unreachable: ${err?.message ?? err}`), "network");
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt < RETRIES) { await sleep(1000 * 2 ** attempt); continue; }
        throw new LlmError(`DeepSeek answered ${res.status}`, "unavailable");
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new LlmError(redact(`DeepSeek refused the request (${res.status}): ${JSON.stringify(data?.error ?? data).slice(0, 300)}`), "bad_request");
      const u = data?.usage ?? {};
      const hit = u.prompt_cache_hit_tokens ?? 0;
      const miss = u.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens ?? 0) - hit);
      const usage = { missTokens: miss, hitTokens: hit, outTokens: u.completion_tokens ?? 0 };
      // The money is spent even when the answer is unusable: record first.
      record({ provider: "deepseek", feature, model, videoId, themeId, tokensIn: miss + hit, tokensOut: usage.outTokens, costMicrousd: costMicrousd(model, usage, now()) });
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === "length") throw new LlmError(`DeepSeek's answer was cut at ${maxTokens} tokens`, "truncated");
      const text = choice?.message?.content ?? "";
      if (!text.trim()) throw new LlmError("DeepSeek returned an empty answer", "empty");
      return { text, usage };
    }
  };
}

// The account balance, as DeepSeek reports it (decimal strings), in integer micro-units per currency.
export async function fetchDeepseekBalance({ apiKey = process.env.DEEPSEEK_API_KEY, fetchImpl = defaultFetch, timeoutMs = 5000 } = {}) {
  if (!apiKey?.trim()) throw new LlmError("DEEPSEEK_API_KEY is missing in .env.local", "no_key");
  const key = apiKey.trim();
  let res;
  try {
    res = await fetchImpl(BALANCE_ENDPOINT, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new LlmError(redactKey(`DeepSeek unreachable: ${err?.message ?? err}`, key), "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new LlmError(redactKey(`DeepSeek refused the balance request (${res.status}): ${JSON.stringify(data?.error ?? data).slice(0, 300)}`, key), "bad_request");
  const balances = (Array.isArray(data?.balance_infos) ? data.balance_infos : [])
    .map((b) => ({ currency: String(b?.currency ?? ""), totalMicro: parseAmount(b?.total_balance) }))
    .filter((b) => b.currency && b.totalMicro != null);
  return { available: data?.is_available === true, balances };
}
