// One theme → one consolidated sheet, from the sheets of the videos filed directly in it.
// Regenerated on demand only (a click), so its cost stays Robin's choice.
import { iso } from "../time.mjs";
import { assertSections, bodyFrom, canonicalHeadings, summaryBody } from "./markdown.mjs";
import { THEME_SECTIONS, THEME_SYSTEM, themeUser } from "./prompts.mjs";

export const THEME_BATCH_CHARS = 60_000;
const MAX_DEPTH = 3;

export function packBlocks(blocks, limit = THEME_BATCH_CHARS) {
  const packs = [];
  let current = [];
  let size = 0;
  for (const block of blocks) {
    if (current.length && size + block.length > limit) {
      packs.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += block.length;
  }
  if (current.length) packs.push(current);
  return packs;
}

export async function buildThemeSheet({ path, videos, model, complete, themeId = null }) {
  const usable = videos.filter((v) => v.summary);
  if (!usable.length) throw new Error("This theme has no summarized video yet.");
  const ask = async (blocks, feature) => {
    const { text } = await complete({ model, system: THEME_SYSTEM, user: themeUser(path, blocks), feature, themeId });
    return bodyFrom(canonicalHeadings(text, THEME_SECTIONS), THEME_SECTIONS[0]);
  };
  const merge = async (blocks, depth) => {
    const packs = packBlocks(blocks);
    if (packs.length === 1 || depth >= MAX_DEPTH) return ask(blocks, "theme_sheet");
    const partials = [];
    for (const pack of packs) partials.push(await ask(pack, "theme_sheet_part"));
    return merge(partials, depth + 1);
  };
  const body = await merge(usable.map((v) => `### ${v.title ?? v.id}\n${summaryBody(v.summary)}`), 1);
  assertSections(body, THEME_SECTIONS, "The theme sheet");
  const sources = usable
    .map((v) => `- [${v.title ?? v.id}](https://www.youtube.com/watch?v=${v.id}) — ${v.channel ?? "unknown channel"}`)
    .join("\n");
  return `# ${path}\n\n${body}\n\n## 📚 Sources\n${sources}\n`;
}

// `seenChanges` is the theme's counter read before the sheet was built: videos filed or moved while
// DeepSeek was writing are not in the sheet, so they stay counted as changes since it.
export function saveThemeSheet(db, themeId, markdown, model, now, { seenChanges = null } = {}) {
  const seen = Number.isInteger(seenChanges) ? seenChanges : null;
  db.prepare(`UPDATE Theme SET sheetMarkdown = ?, sheetModel = ?, sheetGeneratedAt = ?,
                changesSinceSheet = CASE WHEN ? IS NULL THEN 0 ELSE MAX(changesSinceSheet - ?, 0) END
              WHERE id = ?`)
    .run(markdown, model, iso(now), seen, seen, themeId);
}
