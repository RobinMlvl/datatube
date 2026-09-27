// Full-text search over titles, summaries and transcripts (SQLite FTS5). One row per video.

// A user's text becomes quoted FTS terms: no operator, no syntax error, whatever they type.
export function ftsQuery(text) {
  const terms = String(text ?? "").match(/[\p{L}\p{N}_'-]+/gu) ?? [];
  return terms.slice(0, 12).map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

export function indexVideo(db, videoId) {
  const video = db.prepare("SELECT title FROM Video WHERE id = ?").get(videoId);
  if (!video) return;
  const summary = db.prepare("SELECT markdown FROM Summary WHERE videoId = ?").get(videoId);
  const transcript = db.prepare("SELECT text FROM Transcript WHERE videoId = ?").get(videoId);
  db.transaction(() => {
    db.prepare("DELETE FROM SearchIndex WHERE videoId = ?").run(videoId);
    db.prepare("INSERT INTO SearchIndex (videoId, title, summary, transcript) VALUES (?, ?, ?, ?)")
      .run(videoId, video.title ?? "", summary?.markdown ?? "", transcript?.text ?? "");
  })();
}

export function searchVideos(db, query, limit = 20) {
  const match = ftsQuery(query);
  if (!match) return [];
  return db.prepare(`
    SELECT videoId, title, snippet(SearchIndex, -1, '«', '»', '…', 14) AS snippet
    FROM SearchIndex WHERE SearchIndex MATCH ? ORDER BY rank LIMIT ?
  `).all(match, limit);
}
