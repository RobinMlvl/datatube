# DataTube

A local library of knowledge sheets built from YouTube videos.

Paste videos, playlists or channels. DataTube fetches each transcript (yt-dlp), writes a condensed revision sheet (DeepSeek) — a short summary, the key takeaways and the method, from the transcript only — sorts the video into a theme (Jev), and merges a theme's videos into one consolidated sheet. Export any sheet as Markdown, or let Claude Code read the library through the MCP server.

## Setup (once)

1. `brew install yt-dlp deno`
2. `npm install`
3. `cp .env.example .env.local`, then fill in `DEEPSEEK_API_KEY` and `TYPESAFE_API_KEY`
4. `npm run dev` — the app on http://localhost:3000 and the worker, together (the app listens on 127.0.0.1 only: its actions spend API credits)

## Give the library to Claude Code

    claude mcp add datatube -- node /absolute/path/to/DataTube/mcp/server.mjs

Tools: `list_themes`, `search`, `get_video_sheet`, `get_theme_sheet`, `get_transcript`.

## Where things live

- The library is one file: `data/datatube.db` (back it up by copying it).
- Spec: `docs/superpowers/specs/2026-09-27-datatube-design.md`
- The method it comes from: `docs/reference/ytquest/`
