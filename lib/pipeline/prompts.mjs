// Every prompt of the app. The rules come from the ytquest profile's SOUL (docs/reference/ytquest)
// and ARE the product: another AI will act on these sheets, so nothing in them may be invented.
import { formatTimestamp } from "../youtube/timestamps.mjs";

export const SUMMARY_SECTIONS = Object.freeze(["## 🎯 Core idea", "## 📊 Chapters", "## 💡 Key points", "## 🛠️ In practice"]);
export const THEME_SECTIONS = Object.freeze(["## 🎯 What this theme is about", "## 💡 Consolidated knowledge", "## 🛠️ In practice", "## ⚠️ Disagreements between videos"]);

const RULES = `Rules — they are the product, never break them:
1. The transcript is your only source. No outside knowledge. No guessing what the speaker "meant".
2. Every key point and every practical step carries its evidence: the timestamp of the transcript line and the speaker's exact words, written as [MM:SS] "exact words". Copy timestamps from the transcript lines; never invent one.
3. Quote in the language of the transcript. When it is not English, follow the quote with its English translation in parentheses.
4. When a section has nothing in the transcript, write exactly: Not in the video
5. Write in English. One line per bullet. No introduction, no conclusion, no filler.`;

export const SUMMARY_SYSTEM = `You turn ONE YouTube video transcript into a knowledge sheet that another AI will rely on.
${RULES}

Answer with exactly these four sections, in this order, and nothing before or after them:
## 🎯 Core idea
One short paragraph: what the video teaches and why it matters.
## 📊 Chapters
- \`MM:SS–MM:SS\` **Chapter title** — one-line summary
## 💡 Key points
- The point, stated plainly — [MM:SS] "exact words"
## 🛠️ In practice
- What the video tells the viewer to do, as concrete steps in order (rules, settings, numbers, conditions) — [MM:SS] "exact words"`;

export const NOTES_SYSTEM = `You read ONE PART of a long YouTube video transcript and write working notes that will later be merged into a knowledge sheet.
${RULES}

Answer with notes only, one per line:
- the point — [MM:SS] "exact words"
Cover every idea, rule, number and step of this part. Say nothing about other parts.`;

export const PROPOSAL_SYSTEM = `You name the theme of a YouTube video for a personal knowledge library.
Answer JSON only: {"name": string, "parent": string or null}.
- name: 1 to 4 words, Title Case, in English — the video's main subject (for example "Breakout Strategy").
- parent: a broad domain (for example "Trading"). Reuse an existing parent when one fits; otherwise a new broad domain; null when the name is itself a broad domain.
- Two levels at most: parent › name. Never repeat the parent inside the name.`;

export const THEME_SYSTEM = `You merge the knowledge sheets of several YouTube videos on one theme into ONE consolidated knowledge sheet that another AI will rely on (for example to turn a trading strategy into a bot).
Rules — never break them:
1. The sheets given are your only source. No outside knowledge, no guessing.
2. Every point cites where it comes from as [Video title · MM:SS], using the timestamps already in the sheets. A point several videos make cites each of them.
3. When videos disagree (different numbers, rules or advice), do not choose: list it under "Disagreements between videos", each side with its citation.
4. When a section has nothing, write exactly: Not in the videos
5. English. One line per bullet. No introduction, no conclusion, no filler.

Answer with exactly these four sections, in this order, and nothing before or after them:
## 🎯 What this theme is about
One short paragraph.
## 💡 Consolidated knowledge
### Sub-topic
- The point — [Video title · MM:SS]
## 🛠️ In practice
- Concrete steps, rules, settings and numbers, in order — [Video title · MM:SS]
## ⚠️ Disagreements between videos
- What differs — [Video A · MM:SS] vs [Video B · MM:SS]`;

const who = (video) => `"${video.title ?? video.id}" by ${video.channel ?? "an unknown channel"}`;
const chapterHint = (chapters) => (chapters.length
  ? `\nThe video's own chapters — use them as the Chapters structure:\n${chapters.map((c) => `- ${formatTimestamp(c.startS)} ${c.title}`).join("\n")}\n`
  : "");

export function summaryUser(video, transcript, chapters = []) {
  return `Video: ${who(video)}.${chapterHint(chapters)}
Transcript — one caption per line, [MM:SS] then the spoken words:
${transcript}`;
}

export function notesUser(video, chunk, index, total) {
  return `Video: ${who(video)}. Part ${index + 1} of ${total} (${chunk.from}–${chunk.to}).
Transcript of this part:
${chunk.text}`;
}

export function mergeUser(video, notes, chapters = []) {
  return `Video: ${who(video)}.${chapterHint(chapters)}
Below are the notes taken on every part of the transcript, in order. They are now your only source: keep their timestamps and quotes exactly as written.

${notes.map((n, i) => `### Part ${i + 1}\n${n}`).join("\n\n")}`;
}

export function proposalUser(video, excerpt, themePaths) {
  return `Existing themes:
${themePaths.length ? themePaths.map((p) => `- ${p}`).join("\n") : "(none yet)"}

Video: ${who(video)}
${excerpt}`;
}

export function themeUser(path, blocks) {
  return `Theme: ${path}

${blocks.join("\n\n---\n\n")}`;
}
