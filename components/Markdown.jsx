"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkTimestamps } from "@/lib/youtube/timestamps.mjs";

// Sheet headings keep their emoji in the data and the exports; the app renders them without it.
const EMOJI_PREFIX = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u;

function stripLeadingEmoji(children) {
  if (typeof children === "string") return children.replace(EMOJI_PREFIX, "");
  if (Array.isArray(children) && typeof children[0] === "string") {
    return [children[0].replace(EMOJI_PREFIX, ""), ...children.slice(1)];
  }
  return children;
}

function heading(Tag) {
  return function Heading({ children }) {
    return <Tag>{stripLeadingEmoji(children)}</Tag>;
  };
}

// A sheet, rendered. With onSeek, every [MM:SS] becomes a button that moves the player.
export default function Markdown({ markdown, onSeek = null }) {
  const source = onSeek ? linkTimestamps(markdown) : markdown;
  return (
    <div className="sheet">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
          a: ({ href, children }) => {
            if (onSeek && href?.startsWith("#t=")) {
              return (
                <button type="button" onClick={() => onSeek(Number(href.slice(3)))} className="ts">
                  {children}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">{children}</a>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
