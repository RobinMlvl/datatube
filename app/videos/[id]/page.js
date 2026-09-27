import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertTriangle, ArrowUpRight, ChevronLeft, Download, RefreshCw, RotateCcw } from "lucide-react";
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
import { summaryBody } from "@/lib/pipeline/markdown.mjs";
import { getVideo, themeOptions } from "@/lib/queries.mjs";
import { formatTimestamp } from "@/lib/youtube/timestamps.mjs";

const IN_PROGRESS = ["queued", "fetching", "summarizing", "classifying"];

function themeLine(video) {
  if (video.themePath) {
    return video.themeSource === "auto"
      ? `Sorted by Jev${video.classifyConfidence != null ? ` · ${Math.round(video.classifyConfidence / 10)}% sure` : ""}`
      : "Filed by hand";
  }
  return video.themeSource === "proposed" ? "Waiting in To review" : "Not sorted yet";
}

export default async function VideoPage({ params }) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const video = getVideo(db, id);
  if (!video) notFound();
  const busy = IN_PROGRESS.includes(video.state);
  const file = video.summary ? videoSheetFile({ video, summary: video.summary, themePath: video.themePath, model: video.summaryModel }) : null;
  const sheet = video.summary ? summaryBody(video.summary) : null;
  const facts = [video.channel, video.durationS != null ? formatTimestamp(video.durationS) : null, video.language, video.publishedAt].filter(Boolean);
  return (
    <div className="mx-auto max-w-7xl">
      <AutoRefresh active={busy} />
      <Link href="/" className="btn btn-plain -ml-2">
        <ChevronLeft aria-hidden="true" />
        Library
      </Link>
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <h1 className="large-title">{video.title ?? video.id}</h1>
          <p className="subhead mt-1">{[...facts, `${formatUsd(video.costMicrousd)} spent`].join(" · ")}</p>
        </div>
        <StateBadge state={video.state} themeSource={video.themeSource} />
      </div>
      {video.error && (
        <div className="notice notice-negative mt-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
          <span>{video.error}</span>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {file && <CopyButton text={file.content} />}
        {file && (
          <a href={`/api/export/video/${video.id}`} className="btn btn-secondary">
            <Download aria-hidden="true" />
            Download .md
          </a>
        )}
        {video.transcript && !busy && (
          <ActionButton action={regenerateSummaryAction.bind(null, video.id)} label="Regenerate summary" pendingLabel="Queuing…" icon={RefreshCw} />
        )}
        {["failed", "no_transcript"].includes(video.state) && (
          <ActionButton action={retryVideoAction.bind(null, video.id)} label="Retry" pendingLabel="Queuing…" variant="primary" icon={RotateCcw} />
        )}
        <a href={video.url} target="_blank" rel="noreferrer" className="btn btn-plain">
          <ArrowUpRight aria-hidden="true" />
          Open on YouTube
        </a>
      </div>
      <ThemePicker
        videoId={video.id}
        themes={themeOptions(db)}
        currentThemeId={video.themeId}
        themePath={video.themePath}
        themeHref={video.themeId ? `/themes/${video.themeId}` : null}
        themeLine={themeLine(video)}
      />
      <div className="mt-6">
        <VideoWorkspace videoId={video.id} summary={sheet} transcript={video.transcript} />
      </div>
    </div>
  );
}
