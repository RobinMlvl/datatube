"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkTimestamps } from "@/lib/youtube/timestamps.mjs";

// A sheet, rendered. With onSeek, every [MM:SS] becomes a button that moves the player.
export default function Markdown({ markdown, onSeek = null }) {
  const source = onSeek ? linkTimestamps(markdown) : markdown;
  return (
    <div className="sheet">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (onSeek && href?.startsWith("#t=")) {
              return (
                <button type="button" onClick={() => onSeek(Number(href.slice(3)))} className="rounded bg-blue-50 px-1 font-mono text-xs text-blue-700 hover:bg-blue-100">
                  {children}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{children}</a>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
