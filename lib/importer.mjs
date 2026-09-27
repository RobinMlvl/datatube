// Pasted text → new videos in the queue. Lists are expanded by yt-dlp; a video already in the
// library (or twice in the paste) is counted, never queued again.
import { enqueue } from "./jobs.mjs";
import { iso } from "./time.mjs";
import { canonicalVideoUrl, parseInput } from "./youtube/urls.mjs";

export async function importInput(db, text, { listEntries, now }) {
  const items = parseInput(text);
  const invalid = items.filter((i) => i.kind === "invalid").map((i) => i.input);
  const errors = [];
  const entries = [];
  for (const item of items) {
    if (item.kind === "video") entries.push({ videoId: item.videoId, title: null });
    if (item.kind === "playlist" || item.kind === "channel") {
      try {
        entries.push(...(await listEntries(item.url)));
      } catch (err) {
        errors.push({ input: item.url, message: String(err?.message ?? err).slice(0, 300) });
      }
    }
  }
  if (!entries.length) return { batchId: null, imported: 0, skipped: 0, invalid, errors };
  const at = now();
  const counts = db.transaction(() => {
    const batchId = Number(db.prepare("INSERT INTO ImportBatch (input, videoCount, skippedCount, createdAt) VALUES (?, 0, 0, ?)").run(String(text).slice(0, 20_000), iso(at)).lastInsertRowid);
    const exists = db.prepare("SELECT 1 FROM Video WHERE id = ?");
    const insert = db.prepare("INSERT INTO Video (id, url, title, state, importBatchId, createdAt, updatedAt) VALUES (?, ?, ?, 'queued', ?, ?, ?)");
    const seen = new Set();
    let imported = 0;
    let skipped = 0;
    for (const e of entries) {
      if (seen.has(e.videoId) || exists.get(e.videoId)) { skipped++; continue; }
      seen.add(e.videoId);
      insert.run(e.videoId, canonicalVideoUrl(e.videoId), e.title ?? null, batchId, iso(at), iso(at));
      enqueue(db, { videoId: e.videoId, step: "fetch", now: at });
      imported++;
    }
    db.prepare("UPDATE ImportBatch SET videoCount = ?, skippedCount = ? WHERE id = ?").run(imported, skipped, batchId);
    return { batchId, imported, skipped };
  })();
  return { ...counts, invalid, errors };
}
