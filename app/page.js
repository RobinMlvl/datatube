import Link from "next/link";
import { connection } from "next/server";
import AutoRefresh from "@/components/AutoRefresh";
import ImportForm from "@/components/ImportForm";
import VideosTable from "@/components/VideosTable";
import { getDb } from "@/lib/db.mjs";
import { libraryCounts, listVideos, queueStatus } from "@/lib/queries.mjs";

const FILTERS = [["All", null], ["In progress", "active"], ["Done", "done"], ["To review", "review"], ["No transcript", "no_transcript"], ["Failed", "failed"]];

export default async function LibraryPage({ searchParams }) {
  await connection();
  const sp = await searchParams;
  const db = getDb();
  const state = typeof sp.state === "string" ? sp.state : null;
  const q = typeof sp.q === "string" ? sp.q : "";
  const videos = listVideos(db, { state, q });
  const counts = libraryCounts(db);
  // eslint-disable-next-line react-hooks/purity -- Server Component rendered at request time, after connection()
  const queue = queueStatus(db, Date.now());
  const href = (s) => {
    const p = new URLSearchParams();
    if (s) p.set("state", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };
  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh active={queue.pendingJobs > 0} />
      <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-neutral-500">{counts.total} videos · {counts.active} in progress · {counts.review} to review · {counts.failed} failed</p>
      <ImportForm />
      {queue.pausedUntil && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          YouTube is limiting requests. Fetching resumes at {new Date(queue.pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}; summaries keep going.
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTERS.map(([label, s]) => (
          <Link key={label} href={href(s)} className={`rounded-full border px-3 py-1 text-sm ${state === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100"}`}>
            {label}
          </Link>
        ))}
        <form action="/" className="w-full sm:ml-auto sm:w-auto">
          {state && <input type="hidden" name="state" value={state} />}
          <input type="search" name="q" defaultValue={q} placeholder="Search titles, sheets, transcripts" className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm sm:w-72" />
        </form>
      </div>
      <VideosTable videos={videos} />
    </div>
  );
}
