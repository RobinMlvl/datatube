import { getDb } from "@/lib/db.mjs";
import { videoSheetFile } from "@/lib/export.mjs";
import { getVideo } from "@/lib/queries.mjs";

export async function GET(_request, { params }) {
  const { id } = await params;
  const video = getVideo(getDb(), id);
  if (!video?.summary) return new Response("No sheet for this video yet.", { status: 404 });
  const file = videoSheetFile({ video, summary: video.summary, themePath: video.themePath, model: video.summaryModel });
  return new Response(file.content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${file.filename}"` },
  });
}
