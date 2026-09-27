"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronRight } from "lucide-react";
import { acceptProposalAction, moveVideoAction } from "@/app/actions/videos";

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
    <div className="card p-4">
      <Link href={`/videos/${video.id}`} className="headline hover:text-accent">{video.title ?? video.id}</Link>
      <p className="subhead mt-1">
        {video.channel ?? "Unknown channel"} · {video.confidencePermille != null
          ? `Jev's best existing theme was only ${Math.round(video.confidencePermille / 10)}% sure`
          : "No theme existed yet"}
      </p>
      <p className="eyebrow mt-4 mb-2">Proposed theme</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          placeholder="Parent (optional)"
          aria-label="Parent theme"
          className="field w-40"
        />
        <ChevronRight size={16} className="text-label-3" aria-hidden="true" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Theme"
          aria-label="Theme name"
          className="field w-48"
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => run(() => acceptProposalAction(video.id, { name, parent: parent.trim() || null }))}
          className="btn btn-primary"
        >
          <Check aria-hidden="true" />
          Accept
        </button>
      </div>
      {themes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="subhead">or move to</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Existing theme" className="field">
            <option value="">Choose a theme…</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
          </select>
          <button
            type="button"
            disabled={pending || !choice}
            onClick={() => run(() => moveVideoAction(video.id, Number(choice)))}
            className="btn btn-secondary"
          >
            Move
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-negative" role="alert">{error}</p>}
    </div>
  );
}
