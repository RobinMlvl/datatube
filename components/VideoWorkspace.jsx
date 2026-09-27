"use client";

import { useMemo, useRef, useState } from "react";
import { lineSeconds } from "@/lib/youtube/timestamps.mjs";
import Markdown from "./Markdown";

export default function VideoWorkspace({ videoId, summary, transcript }) {
  const frame = useRef(null);
  const [tab, setTab] = useState(summary ? "sheet" : "transcript");
  const [filter, setFilter] = useState("");
  const lines = useMemo(
    () => (transcript ?? "").split("\n").filter(Boolean).map((line) => ({ line, s: lineSeconds(line) })),
    [transcript],
  );
  const needle = filter.trim().toLowerCase();
  const shown = needle ? lines.filter((l) => l.line.toLowerCase().includes(needle)) : lines;

  const seek = (seconds) => {
    const send = (func, args = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    send("seekTo", [seconds, true]);
    send("playVideo");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            ref={frame}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            title="YouTube player"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex gap-2 border-b border-neutral-200">
          {[["sheet", "Sheet"], ["transcript", "Transcript"]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "border-neutral-900 font-medium" : "border-transparent text-neutral-500"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "sheet" && (summary
          ? <div className="mt-4"><Markdown markdown={summary} onSeek={seek} /></div>
          : <p className="mt-4 text-sm text-neutral-500">No sheet yet.</p>)}
        {tab === "transcript" && (
          <div className="mt-4">
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find in the transcript" className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm" />
            {lines.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">No transcript yet.</p>
            ) : (
              <ul className="mt-3 max-h-[70vh] space-y-0.5 overflow-y-auto text-sm">
                {shown.map(({ line, s }, i) => (
                  <li key={i}>
                    <button type="button" disabled={s == null} onClick={() => seek(s)} className="w-full rounded px-2 py-1 text-left hover:bg-neutral-100">{line}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
