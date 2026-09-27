// The two gestures that put a video back to work: Retry, and Regenerate summary.
import { enqueue, hasPendingJob, latestJob } from "../jobs.mjs";
import { iso } from "../time.mjs";

const STATE_OF_STEP = { fetch: "queued", summarize: "summarizing", classify: "classifying" };

function requeue(db, videoId, step, now) {
  db.transaction(() => {
    enqueue(db, { videoId, step, now });
    db.prepare("UPDATE Video SET state = ?, error = NULL, updatedAt = ? WHERE id = ?").run(STATE_OF_STEP[step], iso(now), videoId);
  })();
}

export function retryVideo(db, videoId, now) {
  const video = db.prepare("SELECT state FROM Video WHERE id = ?").get(videoId);
  if (!video) throw new Error("Unknown video.");
  if (!["failed", "no_transcript"].includes(video.state) || hasPendingJob(db, videoId)) {
    throw new Error("Only a failed video can be retried.");
  }
  const last = latestJob(db, videoId);
  const step = video.state === "failed" && last?.state === "failed" ? last.step : "fetch";
  requeue(db, videoId, step, now);
}

export function regenerateSummary(db, videoId, now) {
  if (!db.prepare("SELECT 1 FROM Transcript WHERE videoId = ?").get(videoId)) throw new Error("This video has no transcript yet.");
  if (hasPendingJob(db, videoId)) throw new Error("This video is already being processed.");
  requeue(db, videoId, "summarize", now);
}
