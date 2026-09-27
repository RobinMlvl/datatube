// DataTube's MCP server (stdio, read-only). Claude Code starts it:
//   claude mcp add datatube -- node /absolute/path/to/DataTube/mcp/server.mjs
// stdout carries the protocol: log with console.error only.
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openDb } from "../lib/db.mjs";
import { listThemesText, searchText, themeSheetText, transcriptRangeText, videoSheetText } from "./tools.mjs";

const file = process.env.DATATUBE_DB?.trim() || fileURLToPath(new URL("../data/datatube.db", import.meta.url));
let db = null;
const library = () => {
  db ??= openDb(file, { readonly: true });
  return db;
};

const reply = (fn) => async (args) => {
  try {
    return { content: [{ type: "text", text: fn(library(), args ?? {}) }] };
  } catch (err) {
    const empty = /unable to open|no such file|SQLITE_CANTOPEN|does not exist/i.test(String(err?.message));
    return {
      content: [{ type: "text", text: empty ? "The DataTube library is empty — import videos in the app first." : `DataTube error: ${String(err?.message ?? err).slice(0, 300)}` }],
      isError: !empty,
    };
  }
};

const VideoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/).describe("The 11-character YouTube id");
const Stamp = z.string().describe("A timestamp like 12:34 or 1:02:03");

const server = new McpServer({ name: "datatube", version: "1.0.0" });

server.registerTool("list_themes", {
  title: "List themes",
  description: "The themes of Robin's YouTube knowledge library (Parent › Child), with their ids, video counts and the date of their consolidated sheet.",
  inputSchema: {},
}, reply((lib) => listThemesText(lib)));

server.registerTool("search", {
  title: "Search the library",
  description: "Full-text search over video titles, knowledge sheets and transcripts. Returns video ids to read with get_video_sheet or get_transcript.",
  inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() },
}, reply(searchText));

server.registerTool("get_video_sheet", {
  title: "Read a video's knowledge sheet",
  description: "One video's revision sheet: a short summary, the key takeaways and the method (steps, rules, numbers, settings), condensed from the transcript only.",
  inputSchema: { videoId: VideoId },
}, reply(videoSheetText));

server.registerTool("get_theme_sheet", {
  title: "Read a theme's consolidated sheet",
  description: "The consolidated revision sheet of a theme — the useful data merged across its videos, disagreements between videos listed by title — plus its videos. Give themeId, or name as \"Parent › Child\" or just the name.",
  inputSchema: { themeId: z.number().int().optional(), name: z.string().optional() },
}, reply(themeSheetText));

server.registerTool("get_transcript", {
  title: "Read a transcript",
  description: "A video's timestamped transcript, whole or between two timestamps — to check the exact wording behind a point of a sheet.",
  inputSchema: { videoId: VideoId, from: Stamp.optional(), to: Stamp.optional() },
}, reply(transcriptRangeText));

await server.connect(new StdioServerTransport());
console.error(`[datatube-mcp] ready on ${file}`);
