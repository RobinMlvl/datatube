"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptProposalAction, moveVideoAction } from "@/app/actions/videos";

const BUTTON = "rounded-md border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50";
const FIELD = "rounded-md border border-neutral-300 px-2 py-1.5";

export default function ReviewItem({ video, themes }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [name, setName] = useState(video.proposal?.name ?? "");
  const [parent, setParent] = useState(video.proposal?.parent ?? "");
  const [choice, setChoice] = useState("");
  const run = (fn) => start(async () => {
    setError(null);
    const result = await fn();
    if (!result?.ok) setError(result?.error ?? "Something went wrong.");
  });
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <Link href={`/videos/${video.id}`} className="font-medium hover:underline">{video.title ?? video.id}</Link>
      <p className="text-neutral-500">
        {video.channel ?? "Unknown channel"} · {video.confidencePermille != null
          ? `Jev's best existing theme was only ${Math.round(video.confidencePermille / 10)}% sure`
          : "No theme existed yet"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Parent (optional)" className={`${FIELD} w-40`} />
        <span className="text-neutral-400">›</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Theme" className={`${FIELD} w-48`} />
        <button type="button" disabled={pending || !name.trim()} onClick={() => run(() => acceptProposalAction(video.id, { name, parent: parent.trim() || null }))} className="rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:opacity-50">
          Accept
        </button>
      </div>
      {themes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className={FIELD}>
            <option value="">Or pick an existing theme…</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
          </select>
          <button type="button" disabled={pending || !choice} onClick={() => run(() => moveVideoAction(video.id, Number(choice)))} className={BUTTON}>Move</button>
        </div>
      )}
      {error && <p className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}
