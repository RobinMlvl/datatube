import { getDb } from "@/lib/db.mjs";
import { themeBundleFile, themeSheetFile } from "@/lib/export.mjs";
import { getTheme, themeVideosWithSummaries } from "@/lib/queries.mjs";

export async function GET(request, { params }) {
  const { id } = await params;
  const db = getDb();
  const theme = getTheme(db, Number(id));
  if (!theme) return new Response("Unknown theme.", { status: 404 });
  const bundle = new URL(request.url).searchParams.get("bundle") === "1";
  let file;
  if (bundle) {
    const videos = themeVideosWithSummaries(db, theme.id).filter((v) => v.summary).map((v) => ({ video: v, summary: v.summary }));
    file = themeBundleFile({ path: theme.path, sheetMarkdown: theme.sheetMarkdown, model: theme.sheetModel ?? "—", generatedAt: theme.sheetGeneratedAt, videos });
  } else {
    if (!theme.sheetMarkdown) return new Response("This theme has no consolidated sheet yet.", { status: 404 });
    file = themeSheetFile({ path: theme.path, sheetMarkdown: theme.sheetMarkdown, model: theme.sheetModel, generatedAt: theme.sheetGeneratedAt, videoCount: theme.videos.length });
  }
  return new Response(file.content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${file.filename}"` },
  });
}
