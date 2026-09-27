// The worker: one job at a time, forever, until Ctrl-C. Run with `npm run worker` (or `npm run dev`).
import { openDb } from "../lib/db.mjs";
import { claimNext, completeJob, recoverRunning } from "../lib/jobs.mjs";
import { handleFailure } from "../lib/pipeline/failures.mjs";
import { createLivePipeline } from "../lib/pipeline/live.mjs";

const IDLE_MS = 2000;
const YOUTUBE_GAP_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = openDb();
const recovered = recoverRunning(db, Date.now());
if (recovered) console.log(`[worker] put back ${recovered} job(s) left running`);
const { steps } = createLivePipeline(db);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; });

let lastYoutubeAt = 0;
console.log("[worker] ready");
while (!stopping) {
  const job = claimNext(db, Date.now());
  if (!job) { await sleep(IDLE_MS); continue; }
  if (job.step === "fetch") {
    const wait = lastYoutubeAt + YOUTUBE_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
  }
  const started = Date.now();
  try {
    await steps.run(job);
    completeJob(db, job.id, Date.now());
    console.log(`[worker] ${job.step} ${job.videoId} done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    const outcome = handleFailure(db, job, err, Date.now());
    console.log(`[worker] ${job.step} ${job.videoId} ${outcome}: ${String(err?.message ?? err).slice(0, 200)}`);
  } finally {
    if (job.step === "fetch") lastYoutubeAt = Date.now();
  }
}
db.close();
console.log("[worker] stopped");
