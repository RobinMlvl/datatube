// Jev (TypeSafe System One) classifies: it never writes text, it returns calibrated answers.
import { LlmError } from "./errors.mjs";
import { JEV_MODEL } from "./models.mjs";
import { costMicrousd } from "./prices.mjs";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const RETRIES = 3;
const MAX_WAIT_MS = 20_000;

export function createJev({
  apiKey = process.env.TYPESAFE_API_KEY,
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => new Date(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  record,
} = {}) {
  return async function ask({ state, questions, feature, videoId = null, model = JEV_MODEL, timeoutMs = 60_000 }) {
    if (!apiKey?.trim()) throw new LlmError("TYPESAFE_API_KEY is missing in .env.local", "no_key");
    // Error text reaches the database, the worker log and the page: never let it carry the key.
    const redact = (text) => String(text).split(apiKey.trim()).join("***");
    const body = JSON.stringify({ model, state, questions });
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
        throw new LlmError(redact(`Jev unreachable: ${err?.message ?? err}`), "network");
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt < RETRIES) {
          const header = Number(res.headers?.get?.("retry-after"));
          await sleep(Number.isFinite(header) && header > 0 ? Math.min(header * 1000, MAX_WAIT_MS) : 1000 * 2 ** attempt);
          continue;
        }
        throw new LlmError(`Jev answered ${res.status}`, "unavailable");
      }
      const text = await res.text();
      if (!res.ok) throw new LlmError(redact(`Jev refused the request (${res.status}): ${text.slice(0, 300)}`), "bad_request");
      let out;
      try { out = JSON.parse(text); } catch { throw new LlmError("Jev returned something that is not JSON", "bad_response"); }
      if (!out?.answers || typeof out.answers !== "object") throw new LlmError("Jev returned no answers", "bad_response");
      const tokensIn = out.usage?.input_tokens ?? 0;
      const tokensOut = out.usage?.output_tokens ?? 0;
      // Priced by the model we asked for (always in the grid); the answering version is only a label.
      record({ provider: "typesafe", feature, model: out.model ?? model, videoId, themeId: null, tokensIn, tokensOut, costMicrousd: costMicrousd(model, { missTokens: tokensIn, outTokens: tokensOut }, now()) });
      return out.answers;
    }
  };
}

export function choiceOf(answers, id) {
  const a = answers?.[id];
  if (a?.type !== "choice" || typeof a.choice !== "string") return null;
  const probabilities = a.probabilities && typeof a.probabilities === "object" ? a.probabilities : {};
  const confidence = Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : null;
  return { choice: a.choice, p: Number(probabilities[a.choice]) || 0, confidence, probabilities };
}
