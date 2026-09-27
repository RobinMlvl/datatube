// Start the MCP server like Claude Code does, list its tools and call two of them.
// DATATUBE_DB=data/demo.db node scripts/mcp-smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["mcp/server.mjs"], env: { ...process.env } });
const client = new Client({ name: "datatube-smoke", version: "1.0.0" });
await client.connect(transport);
console.log((await client.listTools()).tools.map((t) => t.name).join(", "));
console.log((await client.callTool({ name: "list_themes", arguments: {} })).content[0].text);
console.log((await client.callTool({ name: "get_theme_sheet", arguments: { name: "Trading › Breakout Strategy" } })).content[0].text.slice(0, 400));
await client.close();
