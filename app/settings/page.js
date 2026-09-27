import path from "node:path";
import { connection } from "next/server";
import SettingsForm from "@/components/SettingsForm";
import { costTotals, formatUsd } from "@/lib/costs.mjs";
import { getDb } from "@/lib/db.mjs";
import { DEEPSEEK_MODELS } from "@/lib/llm/models.mjs";
import { readSettings } from "@/lib/settings.mjs";
import { checkTools } from "@/lib/youtube/ytdlp.mjs";

function Section({ title, children }) {
  return (
    <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  await connection();
  const db = getDb();
  const settings = readSettings(db);
  const tools = await checkTools();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const costs = costTotals(db, { sinceIso: monthStart.toISOString() });
  const keys = [
    ["DeepSeek", "DEEPSEEK_API_KEY", Boolean(process.env.DEEPSEEK_API_KEY?.trim())],
    ["TypeSafe (Jev)", "TYPESAFE_API_KEY", Boolean(process.env.TYPESAFE_API_KEY?.trim())],
  ];
  const server = path.join(process.cwd(), "mcp", "server.mjs");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Section title="Models"><SettingsForm models={[...DEEPSEEK_MODELS]} settings={settings} /></Section>
      <Section title="API keys">
        <ul className="space-y-1">
          {keys.map(([label, env, set]) => (
            <li key={env}>{label}: {set ? <span className="text-emerald-700">set</span> : <span className="text-red-700">missing — add {env} to .env.local, then restart npm run dev</span>}</li>
          ))}
        </ul>
      </Section>
      <Section title="Tools">
        <ul className="space-y-1">
          <li>yt-dlp: {tools.ytDlp ?? <span className="text-red-700">missing — brew install yt-dlp deno</span>}</li>
          <li>deno: {tools.deno ?? <span className="text-red-700">missing — brew install deno</span>}</li>
        </ul>
      </Section>
      <Section title="Spend">
        <p>This month: {formatUsd(costs.sinceMicrousd)} · All time: {formatUsd(costs.allMicrousd)}</p>
      </Section>
      <Section title="Give the library to Claude Code">
        <p className="text-neutral-600">Run once in a terminal; Claude Code can then search and read your sheets while it works.</p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">claude mcp add datatube -- node {server}</pre>
      </Section>
    </div>
  );
}
