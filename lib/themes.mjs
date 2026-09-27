// Themes: two levels at most (Parent › Child). A theme's sheet goes stale by one each time a
// video enters or leaves it (changesSinceSheet).
import { iso } from "./time.mjs";

export function themePath(theme, byId) {
  const parent = theme?.parentId ? byId.get(theme.parentId) : null;
  return parent ? `${parent.name} › ${theme.name}` : theme.name;
}

export const listThemes = (db) => db.prepare("SELECT * FROM Theme ORDER BY name COLLATE NOCASE").all();
export const themesById = (db) => new Map(listThemes(db).map((t) => [t.id, t]));

export function findThemeByPath(db, name, parentName = null) {
  if (parentName) {
    return db.prepare(`SELECT t.* FROM Theme t JOIN Theme p ON p.id = t.parentId
                       WHERE t.name = ? COLLATE NOCASE AND p.name = ? COLLATE NOCASE AND p.parentId IS NULL`).get(name.trim(), parentName.trim()) ?? null;
  }
  return db.prepare("SELECT * FROM Theme WHERE name = ? COLLATE NOCASE AND parentId IS NULL").get(name.trim()) ?? null;
}

function insertTheme(db, name, parentId, now) {
  const id = db.prepare("INSERT INTO Theme (name, parentId, changesSinceSheet, createdAt) VALUES (?, ?, 0, ?)").run(name.trim(), parentId, iso(now)).lastInsertRowid;
  return db.prepare("SELECT * FROM Theme WHERE id = ?").get(id);
}

export function findOrCreateTheme(db, { name, parent = null }, now) {
  return db.transaction(() => {
    const existing = findThemeByPath(db, name, parent);
    if (existing) return existing;
    const parentTheme = parent ? (findThemeByPath(db, parent) ?? insertTheme(db, parent, null, now)) : null;
    return insertTheme(db, name, parentTheme?.id ?? null, now);
  })();
}

export function assignVideo(db, videoId, themeId, source, now) {
  db.transaction(() => {
    const video = db.prepare("SELECT themeId FROM Video WHERE id = ?").get(videoId);
    if (!video) throw new Error("Unknown video.");
    const bump = db.prepare("UPDATE Theme SET changesSinceSheet = changesSinceSheet + 1 WHERE id = ?");
    if (video.themeId !== themeId) {
      if (video.themeId) bump.run(video.themeId);
      if (themeId) bump.run(themeId);
    }
    db.prepare("UPDATE Video SET themeId = ?, themeSource = ?, proposedTheme = NULL, updatedAt = ? WHERE id = ?")
      .run(themeId, themeId ? source : null, iso(now), videoId);
  })();
}

export function acceptProposal(db, videoId, { name, parent = null }, now) {
  const theme = findOrCreateTheme(db, { name, parent }, now);
  assignVideo(db, videoId, theme.id, "manual", now);
  return theme;
}

export function renameTheme(db, themeId, name) {
  const theme = db.prepare("SELECT * FROM Theme WHERE id = ?").get(themeId);
  if (!theme) throw new Error("Unknown theme.");
  const clash = db.prepare("SELECT 1 FROM Theme WHERE name = ? COLLATE NOCASE AND parentId IS ? AND id != ?").get(name.trim(), theme.parentId, themeId);
  if (clash) throw new Error("A theme with this name already exists here.");
  db.prepare("UPDATE Theme SET name = ? WHERE id = ?").run(name.trim(), themeId);
}

export function setThemeParent(db, themeId, parentId) {
  if (parentId === themeId) throw new Error("A theme cannot be its own parent.");
  const hasChildren = db.prepare("SELECT 1 FROM Theme WHERE parentId = ?").get(themeId);
  if (parentId != null) {
    const parent = db.prepare("SELECT * FROM Theme WHERE id = ?").get(parentId);
    if (!parent) throw new Error("Unknown parent theme.");
    if (parent.parentId != null || hasChildren) throw new Error("Themes have two levels at most.");
  }
  db.prepare("UPDATE Theme SET parentId = ? WHERE id = ?").run(parentId, themeId);
}

export function deleteTheme(db, themeId) {
  if (db.prepare("SELECT 1 FROM Theme WHERE parentId = ?").get(themeId)) throw new Error("Move or delete its sub-themes first.");
  if (db.prepare("SELECT 1 FROM Video WHERE themeId = ?").get(themeId)) throw new Error("Move its videos first.");
  db.prepare("DELETE FROM Theme WHERE id = ?").run(themeId);
}

export function recentTitlesByTheme(db, perTheme = 3) {
  const rows = db.prepare("SELECT themeId, title FROM Video WHERE themeId IS NOT NULL AND title IS NOT NULL ORDER BY updatedAt DESC").all();
  const out = new Map();
  for (const r of rows) {
    const list = out.get(r.themeId) ?? [];
    if (list.length < perTheme) list.push(r.title);
    out.set(r.themeId, list);
  }
  return out;
}
