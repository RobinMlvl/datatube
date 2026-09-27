// What a failed step becomes: a pause (YouTube rate limit), a retry, or a failed video with its reason.
import { YOUTUBE_PAUSE_MS, failJob, pauseYoutube, requeueRateLimited } from "../jobs.mjs";
import { iso } from "../time.mjs";

const FINAL_CODES = new Set(["no_key", "bad_request"]);

export const isFinal = (err) => err?.unavailable === true || err?.missing === true || FINAL_CODES.has(err?.code);

export function handleFailure(db, job, err, now) {
  const message = String(err?.message ?? err).slice(0, 500);
  if (err?.rateLimited && job.step === "fetch") {
    const until = now + YOUTUBE_PAUSE_MS;
    pauseYoutube(db, until, now);
    requeueRateLimited(db, job, until, now);
    return "paused";
  }
  const outcome = failJob(db, job, message, now, { final: isFinal(err) });
  if (outcome === "failed") {
    db.prepare("UPDATE Video SET state = 'failed', error = ?, updatedAt = ? WHERE id = ?").run(message, iso(now), job.videoId);
  }
  return outcome;
}
