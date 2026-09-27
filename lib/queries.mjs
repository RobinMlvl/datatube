// Every read the pages and the MCP server make. Plain SQL, one place.
import { sectionText } from "./pipeline/markdown.mjs";
import { SUMMARY_SECTIONS } from "./pipeline/prompts.mjs";
import { getSetting } from "./settings.mjs";
import { ftsQuery } from "./search.mjs";
import { findThemeByPath, listThemes, themePath } from "./themes.mjs";

const ACTIVE = "('queued','fetching','summarizing','classifying')";
const VIDEO_STATES = ["queued", "fetching", "summarizing", "classifying", "done", "no_transcript", "failed"];

const pathSql = "CASE WHEN p.id IS NULL THEN t.name ELSE p.name || ' › ' || t.name END";
const videoSelect = `
  SELECT v.*, ${pathSql} AS themePath, COALESCE(c.cost, 0) AS costMicrousd
  FROM Video v
  LEFT JOIN Theme t ON t.id = v.themeId
  LEFT JOIN Theme p ON p.id = t.parentId
  LEFT JOIN (SELECT videoId, SUM(costMicrousd) AS cost FROM ApiCall GROUP BY videoId) c ON c.videoId = v.id`;

export function listVideos(db, { themeId = null, state = null, q = null, limit = 500 } = {}) {
  const where = [];
  const params = { limit };
  if (Number.isInteger(themeId)) {
    where.push("(v.themeId = @themeId OR v.themeId IN (SELECT id FROM Theme WHERE parentId = @themeId))");
    params.themeId = themeId;
  }
  if (state === "active") where.push(`v.state IN ${ACTIVE}`);
  else if (state === "review") where.push("v.themeSource = 'proposed'");
  else if (VIDEO_STATES.includes(state)) { where.push("v.state = @state"); params.state = state; }
  const match = q ? ftsQuery(q) : "";
  if (match) { where.push("v.id IN (SELECT videoId FROM SearchIndex WHERE SearchIndex MATCH @match)"); params.match = match; }
  return db.prepare(`${videoSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY v.createdAt DESC, v.id LIMIT @limit`).all(params);
}

export function getVideo(db, id) {
  const video = db.prepare(`${videoSelect} WHERE v.id = ?`).get(id);
  if (!video) return null;
  const transcript = db.prepare("SELECT text FROM Transcript WHERE videoId = ?").get(id);
  const summary = db.prepare("SELECT markdown, model FROM Summary WHERE videoId = ?").get(id);
  const lastJob = db.prepare("SELECT * FROM Job WHERE videoId = ? ORDER BY id DESC LIMIT 1").get(id) ?? null;
  return { ...video, transcript: transcript?.text ?? null, summary: summary?.markdown ?? null, summaryModel: summary?.model ?? null, lastJob };
}

export function themeTree(db) {
  const themes = listThemes(db);
  const byId = new Map(themes.map((t) => [t.id, t]));
  const counts = new Map(db.prepare("SELECT themeId, COUNT(*) AS n FROM Video WHERE themeId IS NOT NULL GROUP BY themeId").all().map((r) => [r.themeId, r.n]));
  const node = (t) => ({
    id: t.id, name: t.name, path: themePath(t, byId), parentId: t.parentId,
    videoCount: counts.get(t.id) ?? 0, sheetGeneratedAt: t.sheetGeneratedAt, changesSinceSheet: t.changesSinceSheet, children: [],
  });
  const roots = themes.filter((t) => t.parentId == null).map(node);
  const rootById = new Map(roots.map((r) => [r.id, r]));
  for (const t of themes) if (t.parentId != null) rootById.get(t.parentId)?.children.push(node(t));
  return roots;
}

export function getTheme(db, id) {
  const theme = db.prepare("SELECT * FROM Theme WHERE id = ?").get(id);
  if (!theme) return null;
  const byId = new Map(listThemes(db).map((t) => [t.id, t]));
  return {
    ...theme,
    path: themePath(theme, byId),
    children: db.prepare("SELECT id, name FROM Theme WHERE parentId = ? ORDER BY name COLLATE NOCASE").all(id),
    videos: db.prepare(`${videoSelect} WHERE v.themeId = ? ORDER BY v.title COLLATE NOCASE`).all(id),
  };
}

export function themeVideosWithSummaries(db, themeId) {
  return db.prepare(`SELECT v.*, s.markdown AS summary FROM Video v LEFT JOIN Summary s ON s.videoId = v.id
                     WHERE v.themeId = ? ORDER BY v.publishedAt, v.id`).all(themeId);
}

export function findTheme(db, { themeId = null, name = null } = {}) {
  if (Number.isInteger(themeId)) return db.prepare("SELECT * FROM Theme WHERE id = ?").get(themeId) ?? null;
  if (!name?.trim()) return null;
  const [a, b] = name.split("›").map((s) => s.trim());
  if (b) return findThemeByPath(db, b, a);
  return findThemeByPath(db, a) ?? db.prepare("SELECT * FROM Theme WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1").get(a) ?? null;
}

// Each video waiting for a theme, with DeepSeek's proposal and its sheet's Summary (to choose from).
export function reviewQueue(db) {
  const sheetOf = db.prepare("SELECT markdown FROM Summary WHERE videoId = ?").pluck();
  return db.prepare(`${videoSelect} WHERE v.themeSource = 'proposed' ORDER BY v.updatedAt, v.id`).all().map((v) => {
    let proposal = null;
    try { proposal = JSON.parse(v.proposedTheme ?? "null"); } catch { proposal = null; }
    const sheet = sheetOf.get(v.id);
    return { ...v, proposal, summary: sheet ? sectionText(sheet, SUMMARY_SECTIONS[0]) || null : null };
  });
}

export function libraryCounts(db) {
  return db.prepare(`SELECT COUNT(*) AS total,
                            COALESCE(SUM(themeSource = 'proposed'), 0) AS review,
                            COALESCE(SUM(state = 'failed'), 0) AS failed,
                            COALESCE(SUM(state IN ${ACTIVE}), 0) AS active,
                            COALESCE(SUM(state = 'no_transcript'), 0) AS noTranscript
                     FROM Video`).get();
}

export function themeOptions(db) {
  return themeTree(db).flatMap((root) => [root, ...root.children]).map(({ id, path }) => ({ id, path }));
}

export function queueStatus(db, now) {
  const until = getSetting(db, "queuePausedUntil");
  return {
    pausedUntil: Number.isFinite(until) && until > now ? until : null,
    pendingJobs: db.prepare("SELECT COUNT(*) FROM Job WHERE state IN ('queued','running')").pluck().get(),
  };
}
