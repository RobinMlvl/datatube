import Link from "next/link";
import { connection } from "next/server";
import { Clock, Search } from "lucide-react";
import AutoRefresh from "@/components/AutoRefresh";
import ImportForm from "@/components/ImportForm";
import ThemeFilter from "@/components/ThemeFilter";
import VideosTable from "@/components/VideosTable";
import { getDb } from "@/lib/db.mjs";
import { libraryCounts, listVideos, queueStatus, themeOptions } from "@/lib/queries.mjs";

const FILTERS = [["All", null], ["In progress", "active"], ["Done", "done"], ["To review", "review"], ["No transcript", "no_transcript"], ["Failed", "failed"]];

export default async function LibraryPage({ searchParams }) {
  await connection();
  const sp = await searchParams;
  const db = getDb();
  const state = typeof sp.state === "string" ? sp.state : null;
  const q = typeof sp.q === "string" ? sp.q : "";
  const themes = themeOptions(db);
  const themeId = themes.find((t) => String(t.id) === sp.theme)?.id ?? null;
  const videos = listVideos(db, { themeId, state, q });
  const counts = libraryCounts(db);
  // eslint-disable-next-line react-hooks/purity -- Server Component rendered at request time, after connection()
  const queue = queueStatus(db, Date.now());
  const href = (s) => {
    const p = new URLSearchParams();
    if (themeId) p.set("theme", String(themeId));
    if (s) p.set("state", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };
  return (
    <div className="mx-auto max-w-5xl">
      <AutoRefresh active={queue.pendingJobs > 0} />
      <h1 className="large-title">Library</h1>
      <p className="subhead mt-1 tabular-nums">
        {counts.total} videos · {counts.active} in progress · {counts.review} to review · {counts.failed} failed
      </p>
      <ImportForm />
      {queue.pausedUntil && (
        <div className="notice notice-caution mt-4">
          <Clock className="h-4 w-4 shrink-0 text-caution" />
          <p>
            YouTube is limiting requests. Fetching resumes at{" "}
            {new Date(queue.pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}; summaries keep going.
          </p>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <div className="segmented">
            {FILTERS.map(([label, s]) => (
              <Link key={label} href={href(s)} aria-current={state === s ? "page" : undefined} className="segment">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {themes.length > 0 && <ThemeFilter themes={themes} themeId={themeId} state={state} q={q} />}
          <form action="/" className="relative w-full md:w-64">
            {themeId && <input type="hidden" name="theme" value={themeId} />}
            {state && <input type="hidden" name="state" value={state} />}
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3" />
            <input
              type="search" name="q" defaultValue={q} placeholder="Search"
              aria-label="Search titles, sheets and transcripts"
              className="field w-full pl-8"
            />
          </form>
        </div>
      </div>
      <div className="mt-6">
        <VideosTable videos={videos} />
      </div>
    </div>
  );
}
