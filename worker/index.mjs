// The worker: one job at a time, forever, until Ctrl-C. Run with `npm run worker` (or `npm run dev`).
import fs from "node:fs";
import { dbPath, openDb } from "../lib/db.mjs";
import { claimNext, completeJob, recoverRunning } from "../lib/jobs.mjs";
import { handleFailure } from "../lib/pipeline/failures.mjs";
import { createLivePipeline } from "../lib/pipeline/live.mjs";

const IDLE_MS = 2000;
const YOUTUBE_GAP_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One worker per library: a second one would put the first one's running job back in the queue and
// pay for it twice. The lock holds the pid; a lock left by a dead process is taken over.
const lockFile = `${dbPath()}.worker.lock`;
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === "EPERM"; }
};
const holder = fs.existsSync(lockFile) ? Number(fs.readFileSync(lockFile, "utf8")) : 0;
if (holder && holder !== process.pid && alive(holder)) {
  console.error(`[worker] another worker (pid ${holder}) already runs on this library — not starting a second one`);
  process.exit(1);
}
const db = openDb();
fs.writeFileSync(lockFile, String(process.pid));
process.on("exit", () => {
  if (fs.existsSync(lockFile) && Number(fs.readFileSync(lockFile, "utf8")) === process.pid) fs.rmSync(lockFile, { force: true });
});
const recovered = recoverRunning(db, Date.now());
if (recovered) console.log(`[worker] put back ${recovered} job(s) left running`);
const { steps } = createLivePipeline(db);

// The first Ctrl-C finishes the running step; a second one stops at once (the job is put back at the next start).
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) process.exit(130);
    stopping = true;
  });
}

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
