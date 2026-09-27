// WebVTT → clean timestamped segments — the ytquest method (parse_vtt.py), in JS.
// YouTube's auto captions roll: the clean text is the first line of each one-frame cue
// (< 0.02 s). Manual subtitles have no such cue: every cue counts, its lines joined.
import { formatTimestamp } from "./timestamps.mjs";

const CUE = /^(\d{2,}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2,}):(\d{2}):(\d{2})\.(\d{3})/;
const toSeconds = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

function clean(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cues(vtt) {
  const out = [];
  let current = null;
  for (const raw of String(vtt ?? "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(CUE);
    if (m) {
      current = { start: toSeconds(m[1], m[2], m[3], m[4]), end: toSeconds(m[5], m[6], m[7], m[8]), lines: [] };
      out.push(current);
    } else if (line === "") {
      current = null; // a truly empty line ends a cue; a line holding one space is inside it
    } else if (current) {
      current.lines.push(line);
    }
  }
  return out;
}

export function parseVtt(vtt) {
  const all = cues(vtt);
  const rolling = all.some((c) => c.end - c.start < 0.02);
  const segments = [];
  for (const cue of all) {
    let text;
    if (rolling) {
      if (cue.end - cue.start >= 0.02) continue;
      text = clean(cue.lines.find((l) => l.trim()) ?? "");
    } else {
      text = clean(cue.lines.join(" "));
    }
    if (!text || segments.at(-1)?.text === text) continue;
    segments.push({ startS: Math.floor(cue.start), text });
  }
  return segments;
}

export function transcriptText(segments) {
  return segments.map((s) => `[${formatTimestamp(s.startS)}] ${s.text}`).join("\n");
}
