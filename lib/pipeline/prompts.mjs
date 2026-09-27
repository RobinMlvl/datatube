// Every prompt of the app. A sheet is a revision sheet: the useful data of a video, condensed.
// From the ytquest profile's SOUL (docs/reference/ytquest) the rules keep what matters most: the
// transcript is the only source and nothing may be invented. Robin's decision of 2026-09-27 (after
// the first real run): no quotes and no timestamps in the sheets — just the data.

export const SUMMARY_SECTIONS = Object.freeze(["## 📝 Summary", "## 🎯 Key takeaways", "## 🛠️ Method"]);
export const THEME_SECTIONS = Object.freeze(["## 📝 Summary", "## 🎯 Key takeaways", "## 🛠️ Method", "## ⚠️ Disagreements between videos"]);

const RULES = `Rules — they are the product, never break them:
1. The transcript is your only source. No outside knowledge. No guessing what the speaker "meant".
2. Keep only useful data: facts, rules, numbers, settings, conditions, definitions and steps. Drop anecdotes, self-promotion, greetings, repetition and filler.
3. Be concise, like a revision sheet: short sentences, one line per bullet, no quotes, no timestamps.
4. When a section has nothing in the transcript, write exactly: Not in the video
5. Write in English, whatever the language of the video.`;

export const SUMMARY_SYSTEM = `You turn ONE YouTube video transcript into a revision sheet: the useful data of the video, condensed, for a person or an AI to act on.
${RULES}

Answer with exactly these three sections, in this order, and nothing before or after them:
## 📝 Summary
3 to 5 sentences: what the video is about, its method or argument, and its conclusion.
## 🎯 Key takeaways
- 3 to 8 bullets: the facts and ideas worth remembering.
## 🛠️ Method
1. The steps and rules the video tells the viewer to follow, in order, with the exact numbers, settings and conditions.
Aim for under 400 words in total; a long, dense video may need up to 800. Never pad.`;

export const NOTES_SYSTEM = `You read ONE PART of a long YouTube video transcript and write working notes that will later be merged into a revision sheet.
${RULES}

Answer with notes only, one short line each:
- a fact, rule, number, setting, condition, definition or step
Keep every useful piece of data of this part, once. Say nothing about other parts.`;

export const PROPOSAL_SYSTEM = `You name the theme of a YouTube video for a personal knowledge library.
Answer JSON only: {"name": string, "parent": string or null}.
- name: 1 to 4 words, Title Case, in English — the video's main subject (for example "Breakout Strategy").
- parent: a broad domain (for example "Trading"). Reuse an existing parent when one fits; otherwise a new broad domain; null when the name is itself a broad domain.
- Two levels at most: parent › name. Never repeat the parent inside the name.`;

export const THEME_SYSTEM = `You merge the revision sheets of several YouTube videos on one theme into ONE consolidated revision sheet, for a person or an AI to act on (for example to turn a trading strategy into a bot).
Rules — never break them:
1. The sheets given are your only source. No outside knowledge, no guessing.
2. Keep only useful data, condensed: a point several videos make appears once.
3. When videos disagree (different numbers, rules or advice), do not choose: list it under "Disagreements between videos", naming each video by its title.
4. When a section has nothing, write exactly: Not in the videos
5. English. Short sentences, one line per bullet, no quotes, no timestamps, no filler.

Answer with exactly these four sections, in this order, and nothing before or after them:
## 📝 Summary
3 to 5 sentences: what the theme covers and its main approach.
## 🎯 Key takeaways
- The facts and ideas worth remembering, consolidated; group them under ### sub-topics when there are many.
## 🛠️ Method
1. The consolidated steps and rules, in order, with the exact numbers, settings and conditions.
## ⚠️ Disagreements between videos
- What differs — "Video A" says …; "Video B" says …
Aim for under 800 words in total. Never pad.`;

const who = (video) => `"${video.title ?? video.id}" by ${video.channel ?? "an unknown channel"}`;

export function summaryUser(video, transcript) {
  return `Video: ${who(video)}.
Transcript — one caption per line:
${transcript}`;
}

export function notesUser(video, chunk, index, total) {
  return `Video: ${who(video)}. Part ${index + 1} of ${total} (${chunk.from}–${chunk.to}).
Transcript of this part:
${chunk.text}`;
}

export function mergeUser(video, notes) {
  return `Video: ${who(video)}.
Below are the notes taken on every part of the transcript, in order. They are now your only source: merge them, one line per distinct piece of data, duplicates removed.

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
