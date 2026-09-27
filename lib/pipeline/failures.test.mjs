import { describe, expect, it } from "vitest";
import { openDb } from "../db.mjs";
import { claimNext, enqueue } from "../jobs.mjs";
import { LlmError } from "../llm/errors.mjs";
import { YtDlpError } from "../youtube/ytdlp.mjs";
import { handleFailure, isFinal } from "./failures.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");
function running(step) {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES ('aaaaaaaaaaa', 'u', 'fetching', 't', 't')").run();
  enqueue(db, { videoId: "aaaaaaaaaaa", step, now: T0 });
  return { db, job: claimNext(db, T0) };
}
const state = (db) => db.prepare("SELECT state, error FROM Video").get();

describe("handleFailure", () => {
  it("knows which errors are worth another try", () => {
    expect(isFinal(new LlmError("no key", "no_key"))).toBe(true);
    expect(isFinal(new LlmError("bad", "bad_request"))).toBe(true);
    expect(isFinal(new YtDlpError("gone", { unavailable: true }))).toBe(true);
    expect(isFinal(new YtDlpError("no binary", { missing: true }))).toBe(true);
    expect(isFinal(new LlmError("cut", "truncated"))).toBe(true); // the same request would be cut again, and paid again
    expect(isFinal(new Error("socket hang up"))).toBe(false);
  });

  it("pauses the queue on a YouTube rate limit", () => {
    const { db, job } = running("fetch");
    expect(handleFailure(db, job, new YtDlpError("429", { rateLimited: true }), T0)).toBe("paused");
    expect(state(db).state).toBe("fetching");
  });

  it("retries a passing error, and fails the video on a final one, with a readable reason", () => {
    const a = running("summarize");
    expect(handleFailure(a.db, a.job, new LlmError("DeepSeek unreachable", "network"), T0)).toBe("retry");
    const b = running("summarize");
    expect(handleFailure(b.db, b.job, new LlmError("DEEPSEEK_API_KEY is missing in .env.local", "no_key"), T0)).toBe("failed");
    expect(state(b.db)).toEqual({ state: "failed", error: "DEEPSEEK_API_KEY is missing in .env.local" });
  });
});
