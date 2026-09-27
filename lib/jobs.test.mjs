import { describe, expect, it } from "vitest";
import { openDb } from "./db.mjs";
import { getSetting } from "./settings.mjs";
import { claimNext, completeJob, enqueue, failJob, hasPendingJob, latestJob, pauseYoutube, recoverRunning, requeueRateLimited } from "./jobs.mjs";

const T0 = Date.parse("2026-09-27T10:00:00.000Z");
function lib(ids = ["aaaaaaaaaaa", "bbbbbbbbbbb"]) {
  const db = openDb(":memory:");
  for (const id of ids) db.prepare("INSERT INTO Video (id, url, state, createdAt, updatedAt) VALUES (?, 'u', 'queued', 't', 't')").run(id);
  return db;
}

describe("the job queue", () => {
  it("finishes a video before starting the next: classify, summarize, then fetch", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    enqueue(db, { videoId: "bbbbbbbbbbb", step: "summarize", now: T0 });
    expect(claimNext(db, T0)).toMatchObject({ videoId: "bbbbbbbbbbb", step: "summarize", state: "running", attempts: 1 });
    expect(claimNext(db, T0)).toMatchObject({ videoId: "aaaaaaaaaaa", step: "fetch" });
    expect(claimNext(db, T0)).toBeNull();
  });

  it("waits for runAfter", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0, runAfter: T0 + 60_000 });
    expect(claimNext(db, T0)).toBeNull();
    expect(claimNext(db, T0 + 60_000)).not.toBeNull();
  });

  it("retries after 30 s then 2 min, then fails for good", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "summarize", now: T0 });
    let job = claimNext(db, T0);
    expect(failJob(db, job, "boom", T0)).toBe("retry");
    expect(claimNext(db, T0 + 29_000)).toBeNull();
    job = claimNext(db, T0 + 30_000);
    expect(failJob(db, job, "boom", T0 + 30_000)).toBe("retry");
    job = claimNext(db, T0 + 150_000);
    expect(job.attempts).toBe(3);
    expect(failJob(db, job, "boom", T0 + 150_000)).toBe("failed");
    expect(latestJob(db, "aaaaaaaaaaa")).toMatchObject({ state: "failed", error: "boom" });
  });

  it("fails a final error at once", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "summarize", now: T0 });
    expect(failJob(db, claimNext(db, T0), "no key", T0, { final: true })).toBe("failed");
  });

  it("pauses the YouTube steps only, and a rate limit costs no attempt", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    enqueue(db, { videoId: "bbbbbbbbbbb", step: "fetch", now: T0 });
    const job = claimNext(db, T0);
    const until = T0 + 600_000;
    pauseYoutube(db, until, T0);
    requeueRateLimited(db, job, until, T0);
    expect(getSetting(db, "queuePausedUntil")).toBe(until);
    expect(claimNext(db, T0 + 1000)).toBeNull();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "summarize", now: T0 });
    expect(claimNext(db, T0 + 1000)).toMatchObject({ step: "summarize" });
    expect(claimNext(db, until)).toMatchObject({ step: "fetch", attempts: 1 });
  });

  it("puts back what a killed worker left running, and knows what is pending", () => {
    const db = lib();
    enqueue(db, { videoId: "aaaaaaaaaaa", step: "fetch", now: T0 });
    claimNext(db, T0);
    expect(hasPendingJob(db, "aaaaaaaaaaa")).toBe(true);
    expect(recoverRunning(db, T0)).toBe(1);
    const job = claimNext(db, T0);
    completeJob(db, job.id, T0);
    expect(hasPendingJob(db, "aaaaaaaaaaa")).toBe(false);
  });
});
