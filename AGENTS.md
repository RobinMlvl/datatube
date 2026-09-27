<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## DataTube — rules

Local Next.js app: YouTube links → transcripts → knowledge sheets (DeepSeek) → themes (Jev) → Markdown export + MCP server.
Spec: docs/superpowers/specs/2026-09-27-datatube-design.md · Plan: docs/superpowers/plans/2026-09-27-datatube.md
Original method (read-only): docs/reference/ytquest/

- English everywhere: the interface, the sheets, the code, the commits.
- `lib/`, `worker/`, `mcp/` are `.mjs` with RELATIVE imports only — they also run under plain Node. Only `app/` and `components/` use `@/`.
- Money: integer micro-USD, computed with BigInt, rounded once on the total. Never a float in the database.
- Secrets live in `.env.local` only — never printed, logged, stored or sent to the browser.
- Tests (vitest) never touch the network, yt-dlp or the real clock: inject `now` (ms).
- Dates are UTC ISO strings in the database.
- The sheet rules are the product: the transcript is the only source, every point carries `[MM:SS] "exact words"`, an empty section says `Not in the video`. Never weaken them.
- The MCP server writes nothing to stdout but the protocol: log with `console.error`.
