// What Claude Code can read from the library — pure functions over a read-only database.
import { videoSheetFile, themeSheetFile } from "../lib/export.mjs";
import { findTheme, getTheme, getVideo, themeTree } from "../lib/queries.mjs";
import { searchVideos } from "../lib/search.mjs";
import { lineSeconds, parseTimestamp } from "../lib/youtube/timestamps.mjs";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sheetState = (t) => {
  if (!t.sheetGeneratedAt) return "none";
  const day = t.sheetGeneratedAt.slice(0, 10);
  return t.changesSinceSheet ? `${day}, ${plural(t.changesSinceSheet, "change")} since` : day;
};

export function listThemesText(db) {
  const tree = themeTree(db);
  if (!tree.length) return "The library has no theme yet.";
  const line = (t, indent) => `${indent}- ${t.path} (themeId ${t.id}, ${plural(t.videoCount, "video")}, sheet: ${sheetState(t)})`;
  return tree.flatMap((root) => [line(root, ""), ...root.children.map((c) => line(c, "  "))]).join("\n");
}

export function searchText(db, { query, limit = 10 }) {
  const hits = searchVideos(db, query, limit);
  if (!hits.length) return `No video matches "${query}".`;
  return hits.map((h) => {
    const v = getVideo(db, h.videoId);
    return `- ${v?.title ?? h.videoId} (videoId ${h.videoId}) — theme: ${v?.themePath ?? "unsorted"}\n  ${h.snippet}`;
  }).join("\n");
}

export function videoSheetText(db, { videoId }) {
  const v = getVideo(db, videoId);
  if (!v) return `No video with id ${videoId}.`;
  if (!v.summary) return `"${v.title ?? videoId}" has no sheet yet (state: ${v.state}).`;
  return videoSheetFile({ video: v, summary: v.summary, themePath: v.themePath, model: v.summaryModel }).content;
}

export function themeSheetText(db, { themeId = null, name = null }) {
  const found = findTheme(db, { themeId, name });
  if (!found) return `No theme matches ${themeId != null ? `id ${themeId}` : `"${name}"`}. Call list_themes to see them.`;
  const theme = getTheme(db, found.id);
  const sheet = theme.sheetMarkdown
    ? themeSheetFile({ path: theme.path, sheetMarkdown: theme.sheetMarkdown, model: theme.sheetModel, generatedAt: theme.sheetGeneratedAt, videoCount: theme.videos.length }).content
    : `# ${theme.path}\n\nNo consolidated sheet yet — regenerate it in DataTube, or read the video sheets below with get_video_sheet.\n`;
  const stale = theme.sheetMarkdown && theme.changesSinceSheet
    ? `\n> Note: ${plural(theme.changesSinceSheet, "video change")} since this sheet was written.\n`
    : "";
  const videos = theme.videos.map((v) => `- ${v.title ?? v.id} (videoId ${v.id})`).join("\n") || "(no video)";
  return `${sheet}${stale}\n## Videos in this theme\n${videos}\n`;
}

export function transcriptRangeText(db, { videoId, from = null, to = null }) {
  const v = getVideo(db, videoId);
  if (!v) return `No video with id ${videoId}.`;
  if (!v.transcript) return `"${v.title ?? videoId}" has no transcript (state: ${v.state}).`;
  const start = from ? parseTimestamp(from) : null;
  const end = to ? parseTimestamp(to) : null;
  if ((from && start == null) || (to && end == null)) return "from and to are timestamps like 12:34 or 1:02:03.";
  const lines = v.transcript.split("\n").filter((line) => {
    const s = lineSeconds(line);
    return s != null && (start == null || s >= start) && (end == null || s <= end);
  });
  return lines.length ? lines.join("\n") : "No transcript line in that range.";
}
