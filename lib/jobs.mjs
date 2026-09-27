// The work queue, in SQLite. Only the worker claims; the web app only enqueues.
import { iso } from "./time.mjs";
import { getSetting, setSetting } from "./settings.mjs";

export const RETRY_DELAYS_MS = Object.freeze([30_000, 120_000]);
export const YOUTUBE_PAUSE_MS = 10 * 60_000;

export function enqueue(db, { videoId, step, now, runAfter = now }) {
  const at = iso(now);
  // A fetch queued while YouTube is limiting us waits for the pause to end too.
  const pausedUntil = step === "fetch" ? getSetting(db, "queuePausedUntil") : null;
  const when = Number.isFinite(pausedUntil) && pausedUntil > runAfter ? pausedUntil : runAfter;
  return Number(db.prepare("INSERT INTO Job (videoId, step, state, attempts, runAfter, createdAt, updatedAt) VALUES (?, ?, 'queued', 0, ?, ?, ?)")
    .run(videoId, step, iso(when), at, at).lastInsertRowid);
}

// One statement: the job is taken and marked in the same transaction. With `paid: false` (the
// monthly budget is reached) only the free YouTube step is taken.
export function claimNext(db, now, { paid = true } = {}) {
  return db.prepare(`
    UPDATE Job SET state = 'running', attempts = attempts + 1, updatedAt = @at
    WHERE id = (
      SELECT id FROM Job WHERE state = 'queued' AND runAfter <= @at AND (@paid = 1 OR step = 'fetch')
      ORDER BY CASE step WHEN 'classify' THEN 0 WHEN 'summarize' THEN 1 ELSE 2 END, runAfter, id
      LIMIT 1
    )
    RETURNING *`).get({ at: iso(now), paid: paid ? 1 : 0 }) ?? null;
}

export function completeJob(db, jobId, now) {
  db.prepare("UPDATE Job SET state = 'done', error = NULL, updatedAt = ? WHERE id = ?").run(iso(now), jobId);
}

export function failJob(db, job, message, now, { final = false } = {}) {
  const delay = final ? undefined : RETRY_DELAYS_MS[job.attempts - 1];
  if (delay === undefined) {
    db.prepare("UPDATE Job SET state = 'failed', error = ?, updatedAt = ? WHERE id = ?").run(message, iso(now), job.id);
    return "failed";
  }
  db.prepare("UPDATE Job SET state = 'queued', error = ?, runAfter = ?, updatedAt = ? WHERE id = ?").run(message, iso(now + delay), iso(now), job.id);
  return "retry";
}

// A YouTube rate limit is not the job's fault: it goes back without spending an attempt.
export function requeueRateLimited(db, job, untilMs, now) {
  db.prepare("UPDATE Job SET state = 'queued', attempts = MAX(attempts - 1, 0), runAfter = ?, error = 'YouTube rate limit — paused', updatedAt = ? WHERE id = ?")
    .run(iso(untilMs), iso(now), job.id);
}

export function pauseYoutube(db, untilMs, now) {
  db.prepare("UPDATE Job SET runAfter = MAX(runAfter, ?), updatedAt = ? WHERE state = 'queued' AND step = 'fetch'").run(iso(untilMs), iso(now));
  setSetting(db, "queuePausedUntil", untilMs);
}

export function recoverRunning(db, now) {
  return db.prepare("UPDATE Job SET state = 'queued', updatedAt = ? WHERE state = 'running'").run(iso(now)).changes;
}

export const latestJob = (db, videoId) => db.prepare("SELECT * FROM Job WHERE videoId = ? ORDER BY id DESC LIMIT 1").get(videoId) ?? null;

export const hasPendingJob = (db, videoId) => Boolean(db.prepare("SELECT 1 FROM Job WHERE videoId = ? AND state IN ('queued', 'running')").get(videoId));
