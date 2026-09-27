import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { regenerateSummaryAction, retryVideoAction } from "@/app/actions/videos";
import ActionButton from "@/components/ActionButton";
import AutoRefresh from "@/components/AutoRefresh";
import CopyButton from "@/components/CopyButton";
import StateBadge from "@/components/StateBadge";
import ThemePicker from "@/components/ThemePicker";
import VideoWorkspace from "@/components/VideoWorkspace";
import { formatUsd } from "@/lib/costs.mjs";
import { getDb } from "@/lib/db.mjs";
import { videoSheetFile } from "@/lib/export.mjs";
import { getVideo, themeOptions } from "@/lib/queries.mjs";
import { formatTimestamp } from "@/lib/youtube/timestamps.mjs";

const IN_PROGRESS = ["queued", "fetching", "summarizing", "classifying"];

function themeLine(video) {
  if (video.themePath) {
    const how = video.themeSource === "auto"
      ? ` — sorted by Jev${video.classifyConfidence != null ? ` (${Math.round(video.classifyConfidence / 10)}% sure)` : ""}`
      : " — filed by hand";
    return `${video.themePath}${how}`;
  }
  return video.themeSource === "proposed" ? "Waiting in To review." : "Not sorted yet.";
}

export default async function VideoPage({ params }) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const video = getVideo(db, id);
  if (!video) notFound();
  const busy = IN_PROGRESS.includes(video.state);
  const file = video.summary ? videoSheetFile({ video, summary: video.summary, themePath: video.themePath, model: video.summaryModel }) : null;
  const facts = [video.channel, video.durationS != null ? formatTimestamp(video.durationS) : null, video.language, video.publishedAt].filter(Boolean);
  return (
    <div className="mx-auto max-w-7xl">
      <AutoRefresh active={busy} />
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Library</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{video.title ?? video.id}</h1>
          <p className="mt-1 text-sm text-neutral-500">{[...facts, `${formatUsd(video.costMicrousd)} spent`].join(" · ")}</p>
        </div>
        <StateBadge state={video.state} themeSource={video.themeSource} />
      </div>
      {video.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{video.error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {file && <CopyButton text={file.content} />}
        {file && <a href={`/api/export/video/${video.id}`} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Download .md</a>}
        {video.transcript && !busy && <ActionButton action={regenerateSummaryAction.bind(null, video.id)} label="Regenerate summary" pendingLabel="Queuing…" />}
        {["failed", "no_transcript"].includes(video.state) && <ActionButton action={retryVideoAction.bind(null, video.id)} label="Retry" pendingLabel="Queuing…" variant="primary" />}
        <a href={video.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">Open on YouTube</a>
      </div>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium">Theme</h2>
        <p className="mt-1 text-sm text-neutral-600">{themeLine(video)}</p>
        <div className="mt-3"><ThemePicker videoId={video.id} themes={themeOptions(db)} currentThemeId={video.themeId} /></div>
      </section>
      <div className="mt-6"><VideoWorkspace videoId={video.id} summary={video.summary} transcript={video.transcript} /></div>
    </div>
  );
}
