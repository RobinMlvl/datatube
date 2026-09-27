// The shape of a sheet: its header (written by code), its sections (written by the model).
import { LlmError } from "../llm/errors.mjs";
import { formatTimestamp } from "../youtube/timestamps.mjs";
import { SUMMARY_SECTIONS } from "./prompts.mjs";

export function sheetHeader(video) {
  const meta = [
    `**Channel:** ${video.channel ?? "—"}`,
    `**Duration:** ${video.durationS != null ? formatTimestamp(video.durationS) : "—"}`,
    `**Language:** ${video.language ?? "—"}`,
    `**Published:** ${video.publishedAt ?? "—"}`,
    `**Link:** https://www.youtube.com/watch?v=${video.id}`,
  ].join(" · ");
  return `# ${video.title ?? video.id}\n${meta}`;
}

// A model sometimes drops the invisible U+FE0F of "🛠️" or "⚠️": put each expected heading line back
// in its exact form before the sections are checked.
const bare = (line) => line.replace(/\uFE0F/g, "").trim();
export function canonicalHeadings(text, headings) {
  const exact = new Map(headings.map((h) => [bare(h), h]));
  return String(text ?? "").split("\n").map((line) => exact.get(bare(line)) ?? line).join("\n");
}

export function bodyFrom(text, firstHeading) {
  const s = String(text ?? "");
  const i = s.indexOf(firstHeading);
  return (i < 0 ? s : s.slice(i)).trim();
}

export function assertSections(text, headings, what) {
  const missing = headings.filter((h) => !text.includes(h));
  if (missing.length) throw new LlmError(`${what} is missing: ${missing.join(", ")}`, "bad_format");
}

export function sectionText(markdown, heading) {
  const s = String(markdown ?? "");
  const start = s.indexOf(heading);
  if (start < 0) return "";
  const rest = s.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

export function summaryBody(markdown) {
  return bodyFrom(markdown, SUMMARY_SECTIONS[0]);
}

export function parseChapters(json) {
  try {
    const list = JSON.parse(json ?? "[]");
    return Array.isArray(list) ? list.filter((c) => Number.isFinite(c?.startS)) : [];
  } catch {
    return [];
  }
}
