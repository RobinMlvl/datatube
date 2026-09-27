// One video → one knowledge sheet. Past 50K characters the transcript is read in 40K parts
// overlapping by 2K (the ytquest method): notes per part, then one merge into the sheet.
import { formatTimestamp, lineSeconds } from "../youtube/timestamps.mjs";
import { NOTES_SYSTEM, SUMMARY_SECTIONS, SUMMARY_SYSTEM, mergeUser, notesUser, summaryUser } from "./prompts.mjs";
import { assertSections, bodyFrom, parseChapters, sheetHeader } from "./markdown.mjs";

export const CHUNK_THRESHOLD = 50_000;
export const CHUNK_SIZE = 40_000;
export const CHUNK_OVERLAP = 2_000;

const stampOf = (line) => {
  const s = lineSeconds(line);
  return s == null ? "?" : formatTimestamp(s);
};

export function chunkTranscript(text, { size = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
  const lines = String(text ?? "").split("\n");
  const parts = [];
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let length = 0;
    while (end < lines.length && (end === start || length + lines[end].length + 1 <= size)) {
      length += lines[end].length + 1;
      end++;
    }
    parts.push(lines.slice(start, end));
    if (end >= lines.length) break;
    // Step back so the next part re-reads up to `overlap` characters — never to `start` itself.
    let back = end;
    let backLength = 0;
    while (back > start + 1 && backLength + lines[back - 1].length + 1 <= overlap) {
      back--;
      backLength += lines[back].length + 1;
    }
    start = back;
  }
  return parts.map((ls) => ({ text: ls.join("\n"), from: stampOf(ls[0]), to: stampOf(ls.at(-1)) }));
}

export async function summarizeVideo({ video, transcript, model, complete }) {
  const chapters = parseChapters(video.chapters);
  let answer;
  if (transcript.length <= CHUNK_THRESHOLD) {
    answer = await complete({ model, system: SUMMARY_SYSTEM, user: summaryUser(video, transcript, chapters), feature: "summary" });
  } else {
    const chunks = chunkTranscript(transcript);
    const notes = [];
    for (const [i, chunk] of chunks.entries()) {
      const part = await complete({ model, system: NOTES_SYSTEM, user: notesUser(video, chunk, i, chunks.length), feature: "summary_notes" });
      notes.push(part.text.trim());
    }
    answer = await complete({ model, system: SUMMARY_SYSTEM, user: mergeUser(video, notes, chapters), feature: "summary_merge" });
  }
  const body = bodyFrom(answer.text, SUMMARY_SECTIONS[0]);
  assertSections(body, SUMMARY_SECTIONS, "The summary");
  return `${sheetHeader(video)}\n\n${body}\n`;
}
