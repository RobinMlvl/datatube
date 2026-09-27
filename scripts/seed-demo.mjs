// A demo library to look at the pages without API keys: node scripts/seed-demo.mjs [data/demo.db]
import fs from "node:fs";
import { openDb } from "../lib/db.mjs";
import { recordApiCall } from "../lib/costs.mjs";
import { saveThemeSheet } from "../lib/pipeline/themeSheet.mjs";
import { indexVideo } from "../lib/search.mjs";
import { assignVideo, findOrCreateTheme } from "../lib/themes.mjs";

const file = process.argv[2] ?? "data/demo.db";
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${file}${suffix}`, { force: true });
const db = openDb(file);
const now = Date.now();
const at = new Date(now).toISOString();

const SHEET = (title) => `# ${title}
**Channel:** Demo Channel · **Duration:** 12:34 · **Language:** en · **Published:** 2026-04-12 · **Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ

## 🎯 Core idea
Trade the break of a well-defined range, with the stop under the range.
## 📊 Chapters
- \`00:00–01:35\` **Intro** — why ranges matter
- \`01:35–12:34\` **The setup** — entry, stop, target
## 💡 Key points
- Wait for a candle to close outside the range — [01:05] "wait for the candle to close above resistance"
- The stop goes under the range low — [03:10] "your stop goes just under the range"
## 🛠️ In practice
- Mark the range on the 1-hour chart — [02:00] "mark the range on the one hour"
- Enter on the close, target 2R — [04:20] "take profit at two R"
`;

const videos = [
  ["dQw4w9WgXcQ", "Breakout strategy explained", "done"],
  ["9bZkp7q19f0", "Stop placement for breakouts", "done"],
  ["kJQP7kiw5Fk", "Scalping the open", "done"],
  ["3JZ_D3ELwOQ", "A video without subtitles", "no_transcript"],
  ["L_jWHffIx5E", "A broken import", "failed"],
];
for (const [id, title, state] of videos) {
  db.prepare("INSERT INTO Video (id, url, title, channel, durationS, language, publishedAt, state, error, createdAt, updatedAt) VALUES (?, ?, ?, 'Demo Channel', 754, 'en', '2026-04-12', ?, ?, ?, ?)")
    .run(id, `https://www.youtube.com/watch?v=${id}`, title, state, state === "failed" ? "ERROR: [youtube] Video unavailable" : null, at, at);
  if (state === "done") {
    db.prepare("INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES (?, 'en', 'auto', ?, 200)")
      .run(id, "[01:05] wait for the candle to close above resistance\n[03:10] your stop goes just under the range\n[04:20] take profit at two R");
    db.prepare("INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES (?, ?, 'deepseek-v4-flash', ?)").run(id, SHEET(title), at);
    recordApiCall(db, { provider: "deepseek", feature: "summary", model: "deepseek-v4-flash", videoId: id, costMicrousd: 2106, at: now });
  }
  indexVideo(db, id);
}
const breakout = findOrCreateTheme(db, { name: "Breakout Strategy", parent: "Trading" }, now);
assignVideo(db, "dQw4w9WgXcQ", breakout.id, "auto", now);
assignVideo(db, "9bZkp7q19f0", breakout.id, "manual", now);
db.prepare("UPDATE Video SET themeSource = 'proposed', proposedTheme = ?, classifyConfidence = 420 WHERE id = 'kJQP7kiw5Fk'")
  .run(JSON.stringify({ name: "Scalping", parent: "Trading" }));
saveThemeSheet(db, breakout.id, `# Trading › Breakout Strategy

## 🎯 What this theme is about
Trading the break of a range.
## 💡 Consolidated knowledge
### Entry
- Wait for the close outside the range — [Breakout strategy explained · 01:05]
## 🛠️ In practice
- Stop under the range low — [Stop placement for breakouts · 03:10]
## ⚠️ Disagreements between videos
Not in the videos

## 📚 Sources
- [Breakout strategy explained](https://www.youtube.com/watch?v=dQw4w9WgXcQ) — Demo Channel
`, "deepseek-v4-flash", now);
db.close();
console.log(`Demo library written to ${file}`);
