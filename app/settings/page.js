import path from "node:path";
import { connection } from "next/server";
import CopyButton from "@/components/CopyButton";
import SettingsForm from "@/components/SettingsForm";
import { costTotals, formatUsd } from "@/lib/costs.mjs";
import { getDb } from "@/lib/db.mjs";
import { DEEPSEEK_MODELS } from "@/lib/llm/models.mjs";
import { readSettings } from "@/lib/settings.mjs";
import { checkTools } from "@/lib/youtube/ytdlp.mjs";

function SectionHeading({ children }) {
  return <p className="eyebrow mb-2 px-1">{children}</p>;
}

function Row({ label, helper, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-[14px]">{label}</p>
        {helper && <p className="subhead">{helper}</p>}
      </div>
      <div>{children}</div>
    </div>
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
  const command = `claude mcp add datatube -- node ${server}`;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="large-title">Settings</h1>

      <section className="mt-8">
        <SectionHeading>Models</SectionHeading>
        <SettingsForm models={[...DEEPSEEK_MODELS]} settings={settings} />
      </section>

      <section className="mt-8">
        <SectionHeading>API keys</SectionHeading>
        <div className="card rows">
          {keys.map(([label, env, set]) => (
            <Row key={env} label={label} helper={!set ? `Add ${env} to .env.local, then restart npm run dev` : null}>
              {set ? <span className="status status-done">Set</span> : <span className="status status-negative">Missing</span>}
            </Row>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading>Tools</SectionHeading>
        <div className="card rows">
          <Row label="yt-dlp" helper={!tools.ytDlp ? <span className="font-mono">brew install yt-dlp deno</span> : null}>
            {tools.ytDlp ? <span className="font-mono text-[13px] text-label-2">{tools.ytDlp}</span> : <span className="status status-negative">Missing</span>}
          </Row>
          <Row label="deno" helper={!tools.deno ? <span className="font-mono">brew install yt-dlp deno</span> : null}>
            {tools.deno ? <span className="font-mono text-[13px] text-label-2">{tools.deno}</span> : <span className="status status-negative">Missing</span>}
          </Row>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading>Spend</SectionHeading>
        <div className="card rows">
          <Row label="This month">
            <span className="text-[14px] tabular-nums">{formatUsd(costs.sinceMicrousd)}</span>
          </Row>
          <Row label="All time">
            <span className="text-[14px] tabular-nums">{formatUsd(costs.allMicrousd)}</span>
          </Row>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading>Claude Code</SectionHeading>
        <div className="card rows">
          <div className="px-4 py-3">
            <p className="subhead">Run once in a terminal; Claude Code can then search and read your sheets.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <pre className="code-block min-w-0 flex-1">{command}</pre>
              <CopyButton text={command} label="Copy command" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
