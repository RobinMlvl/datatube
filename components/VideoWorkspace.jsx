"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { formatTimestamp, lineSeconds } from "@/lib/youtube/timestamps.mjs";
import Markdown from "./Markdown";

export default function VideoWorkspace({ videoId, summary, transcript }) {
  const frame = useRef(null);
  const [tab, setTab] = useState(summary ? "sheet" : "transcript");
  const [filter, setFilter] = useState("");
  const lines = useMemo(
    () => (transcript ?? "").split("\n").filter(Boolean).map((line) => ({
      line,
      s: lineSeconds(line),
      words: line.replace(/^\[[^\]]*\]\s*/, ""),
    })),
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
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
        <div role="tablist" aria-label="Video content" className="segmented">
          {[["sheet", "Sheet"], ["transcript", "Transcript"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className="segment"
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "sheet" && (
          <div id="panel-sheet" role="tabpanel" aria-labelledby="tab-sheet" className="mt-4">
            {summary
              ? <div className="card p-5 md:p-6"><Markdown markdown={summary} onSeek={seek} /></div>
              : <p className="subhead">No sheet yet.</p>}
          </div>
        )}
        {tab === "transcript" && (
          <div id="panel-transcript" role="tabpanel" aria-labelledby="tab-transcript" className="mt-4">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find in the transcript"
                aria-label="Find in the transcript"
                className="field w-full pl-8"
              />
            </div>
            {lines.length === 0 ? (
              <p className="subhead mt-3">No transcript yet.</p>
            ) : (
              <div className="card rows mt-3 max-h-[70vh] overflow-y-auto">
                {shown.map(({ line, s, words }, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={s == null}
                    onClick={() => seek(s)}
                    className="flex w-full gap-3 px-4 py-2 text-left hover:bg-fill/60"
                  >
                    <span className="w-14 shrink-0 font-mono text-[12px] tabular-nums text-accent">{s != null ? formatTimestamp(s) : ""}</span>
                    <span className="text-[14px]">{words}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
