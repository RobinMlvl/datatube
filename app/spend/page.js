import Link from "next/link";
import { connection } from "next/server";
import BudgetBanner from "@/components/BudgetBanner";
import SpendBars from "@/components/SpendBars";
import { budgetStatus } from "@/lib/budget.mjs";
import { formatUsd, formatUsdPrecise } from "@/lib/costs.mjs";
import { getDb } from "@/lib/db.mjs";
import { fetchDeepseekBalance } from "@/lib/llm/deepseek.mjs";
import {
  reconcileDeepseek,
  recentCalls,
  spendByDay,
  spendByFeature,
  spendByProvider,
  spendOverview,
  topThemes,
  topVideos,
} from "@/lib/spend.mjs";

const PROVIDER_LABEL = { deepseek: "DeepSeek", typesafe: "Jev (TypeSafe)" };
const FEATURE_LABEL = {
  summary: "Video sheet",
  summary_notes: "Long video · part notes",
  summary_merge: "Long video · merge",
  theme_proposal: "Theme name proposal",
  classify: "Theme sorting",
  theme_sheet: "Theme sheet",
  theme_sheet_part: "Large theme · partial sheet",
};
const providerLabel = (p) => PROVIDER_LABEL[p] ?? p;
const featureLabel = (f) => FEATURE_LABEL[f] ?? f;
const shortDate = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatCallTime = (isoString) => {
  const d = new Date(isoString);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
};
const formatTokens = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
// A non-USD balance has no recorded costs to compare against — shown as-is, no reconciliation.
const formatOtherCurrency = (totalMicro) =>
  (totalMicro / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SectionEyebrow({ children }) {
  return <p className="eyebrow mb-2 px-1">{children}</p>;
}

function SectionTitle({ children }) {
  return <p className="title-2 mb-3">{children}</p>;
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

async function readDeepseekBalance(db, now) {
  let balances;
  try {
    ({ balances } = await fetchDeepseekBalance());
  } catch (err) {
    return err.code === "no_key" ? { kind: "no_key" } : { kind: "error", message: err.message };
  }
  const usd = balances.find((b) => b.currency === "USD");
  if (usd) return { kind: "usd", totalMicro: usd.totalMicro, reconcile: reconcileDeepseek(db, { currency: "USD", totalMicro: usd.totalMicro }, now) };
  if (balances[0]) return { kind: "other", totalMicro: balances[0].totalMicro, currency: balances[0].currency };
  return { kind: "error", message: "DeepSeek reported no balance." };
}

export default async function SpendPage() {
  await connection();
  // eslint-disable-next-line react-hooks/purity -- Server Component rendered at request time, after connection()
  const now = Date.now();
  const db = getDb();

  const overview = spendOverview(db, now);
  const budget = budgetStatus(db, now);
  const deepseek = await readDeepseekBalance(db, now);
  const days = spendByDay(db, now, 30);
  const byProvider = spendByProvider(db);
  const byFeature = spendByFeature(db);
  const videos = topVideos(db, 10);
  const themes = topThemes(db, 10);
  const calls = recentCalls(db, 50);
  const hasCalls = overview.calls > 0;
  const barTone = budget.level === "reached" ? "bg-negative" : budget.level === "warning" ? "bg-caution" : "bg-accent";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="large-title">Spend</h1>
      <p className="subhead mt-1">What the DeepSeek and Jev calls cost, recorded call by call.</p>

      <div className="mt-4">
        <BudgetBanner budget={budget} />
      </div>

      <section className="mt-8">
        <SectionEyebrow>Overview</SectionEyebrow>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="card p-4">
            <p className="eyebrow">Today</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{formatUsdPrecise(overview.todayMicrousd)}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">This month</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{formatUsdPrecise(overview.monthMicrousd)}</p>
            {budget.budgetMicrousd != null ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                  <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(budget.usedPermille, 1000) / 10}%` }} />
                </div>
                <p className="subhead mt-1.5">
                  of {formatUsd(budget.budgetMicrousd)} · resets {shortDate(budget.resetsAt)}
                </p>
              </div>
            ) : (
              <Link href="/settings" className="btn btn-plain -ml-2 mt-2">Set a monthly budget</Link>
            )}
          </div>
          <div className="card p-4">
            <p className="eyebrow">All time</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{formatUsdPrecise(overview.allMicrousd)}</p>
            <p className="subhead mt-1 tabular-nums">{overview.calls} calls</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionEyebrow>DeepSeek account</SectionEyebrow>
        <div className="card rows">
          {deepseek.kind === "no_key" && (
            <Row label="Balance"><span className="subhead">Add DEEPSEEK_API_KEY to .env.local to read the balance.</span></Row>
          )}
          {deepseek.kind === "error" && (
            <Row label="Balance"><span className="subhead">Could not read the balance — {deepseek.message}</span></Row>
          )}
          {deepseek.kind === "other" && (
            <Row label="Balance"><span className="text-[14px] tabular-nums">{formatOtherCurrency(deepseek.totalMicro)} {deepseek.currency}</span></Row>
          )}
          {deepseek.kind === "usd" && (
            <>
              <Row label="Balance"><span className="text-[14px] tabular-nums">{formatUsdPrecise(deepseek.totalMicro)}</span></Row>
              {deepseek.reconcile.started ? (
                <Row label="Since"><span className="subhead">Starting point saved — the comparison appears after the next calls.</span></Row>
              ) : (
                <>
                  <Row label={`Real spend since ${shortDate(deepseek.reconcile.sinceMs)}`}>
                    <span className="text-[14px] tabular-nums">{formatUsdPrecise(deepseek.reconcile.realMicro)}</span>
                  </Row>
                  <Row label="Recorded by DataTube">
                    <span className="text-[14px] tabular-nums">{formatUsdPrecise(deepseek.reconcile.estimatedMicrousd)}</span>
                  </Row>
                  <Row label="Difference" helper="A gap means a call was billed but not recorded, or a price in the table is off.">
                    <span className="text-[14px] tabular-nums">
                      {deepseek.reconcile.realMicro - deepseek.reconcile.estimatedMicrousd < 0 ? "-" : ""}
                      {formatUsdPrecise(Math.abs(deepseek.reconcile.realMicro - deepseek.reconcile.estimatedMicrousd))}
                    </span>
                  </Row>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionEyebrow>Last 30 days</SectionEyebrow>
        <div className="card p-4">
          <SpendBars days={days} />
        </div>
      </section>

      {hasCalls ? (
        <>
          <section className="mt-8">
            <SectionTitle>By provider</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-[12px] font-medium text-label-2">
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Calls</th>
                    <th className="px-4 py-2.5 font-medium">Tokens in</th>
                    <th className="px-4 py-2.5 font-medium">Tokens out</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.map((p) => (
                    <tr key={p.provider} className="h-12 border-t border-separator hover:bg-fill/50">
                      <td className="px-4 py-2 font-medium text-label">{providerLabel(p.provider)}</td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{p.calls}</td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{formatTokens(p.tokensIn)}</td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{formatTokens(p.tokensOut)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsdPrecise(p.costMicrousd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle>By use</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-[12px] font-medium text-label-2">
                    <th className="px-4 py-2.5 font-medium">Use</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Calls</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byFeature.map((f) => (
                    <tr key={`${f.provider}:${f.feature}`} className="h-12 border-t border-separator hover:bg-fill/50">
                      <td className="px-4 py-2 font-medium text-label">{featureLabel(f.feature)}</td>
                      <td className="px-4 py-2 text-label-2">{providerLabel(f.provider)}</td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{f.calls}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsdPrecise(f.costMicrousd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle>Most expensive videos</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-[12px] font-medium text-label-2">
                    <th className="px-4 py-2.5 font-medium">Video</th>
                    <th className="px-4 py-2.5 font-medium">Calls</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr key={v.videoId} className="h-12 border-t border-separator hover:bg-fill/50">
                      <td className="max-w-md px-4 py-2">
                        {v.title ? (
                          <Link href={`/videos/${v.videoId}`} className="font-medium text-label hover:text-accent">{v.title}</Link>
                        ) : (
                          <span className="text-label-3">Deleted video · {v.videoId}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{v.calls}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsdPrecise(v.costMicrousd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle>Most expensive theme sheets</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-[12px] font-medium text-label-2">
                    <th className="px-4 py-2.5 font-medium">Theme</th>
                    <th className="px-4 py-2.5 font-medium">Calls</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {themes.map((t) => (
                    <tr key={t.themeId} className="h-12 border-t border-separator hover:bg-fill/50">
                      <td className="max-w-md px-4 py-2">
                        {t.path ? (
                          <Link href={`/themes/${t.themeId}`} className="font-medium text-label hover:text-accent">{t.path}</Link>
                        ) : (
                          <span className="text-label-3">Deleted theme</span>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{t.calls}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsdPrecise(t.costMicrousd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <SectionTitle>Latest calls</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-[12px] font-medium text-label-2">
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Use</th>
                    <th className="px-4 py-2.5 font-medium">Target</th>
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium">Tokens</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id} className="h-12 border-t border-separator hover:bg-fill/50">
                      <td className="px-4 py-2 tabular-nums text-label-2">{formatCallTime(c.createdAt)}</td>
                      <td className="px-4 py-2 text-label">{featureLabel(c.feature)}</td>
                      <td className="max-w-xs px-4 py-2">
                        {c.videoId ? (
                          c.videoTitle ? (
                            <Link href={`/videos/${c.videoId}`} className="text-label-2 hover:text-accent">{c.videoTitle}</Link>
                          ) : (
                            <span className="text-label-3">Deleted video</span>
                          )
                        ) : c.themeId ? (
                          c.themePath ? (
                            <Link href={`/themes/${c.themeId}`} className="text-label-2 hover:text-accent">{c.themePath}</Link>
                          ) : (
                            <span className="text-label-3">Deleted theme</span>
                          )
                        ) : (
                          <span className="text-label-3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-[12px] text-label-2">{c.model ?? "—"}</td>
                      <td className="px-4 py-2 tabular-nums text-label-2">{formatTokens(c.tokensIn)} → {formatTokens(c.tokensOut)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsdPrecise(c.costMicrousd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="card mt-8 p-8 text-center">
          <p className="subhead">No API call yet — costs appear here as videos are summarized.</p>
        </div>
      )}
    </div>
  );
}
