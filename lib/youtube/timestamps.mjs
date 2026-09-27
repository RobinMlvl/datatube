// [MM:SS] is the unit of evidence in every sheet: written here, read back here.
const pad = (n) => String(n).padStart(2, "0");

export function formatTimestamp(seconds) {
  const t = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function parseTimestamp(text) {
  const m = String(text ?? "").trim().match(/^(?:(\d+):)?(\d+):(\d{2})(?:[.,]\d+)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function lineSeconds(line) {
  const m = String(line ?? "").match(/^\[(\d+(?::\d{2}){1,2})\]/);
  return m ? parseTimestamp(m[1]) : null;
}

export function linkTimestamps(markdown) {
  return String(markdown ?? "").replace(/\[(\d{1,3}:\d{2}(?::\d{2})?)\](?!\()/g, (match, stamp) => {
    const s = parseTimestamp(stamp);
    return s == null ? match : `[${stamp}](#t=${s})`;
  });
}
