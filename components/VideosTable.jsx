import Link from "next/link";
import { formatUsd } from "@/lib/costs.mjs";
import { formatTimestamp } from "@/lib/youtube/timestamps.mjs";
import StateBadge from "./StateBadge";

export default function VideosTable({ videos, empty = "No video here yet. Paste links above to start." }) {
  if (!videos.length) {
    return (
      <div className="card p-8 text-center">
        <p className="subhead">{empty}</p>
      </div>
    );
  }
  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-separator text-[12px] font-medium text-label-2">
              <th className="px-4 py-2.5 font-medium">Video</th>
              <th className="px-4 py-2.5 font-medium">Channel</th>
              <th className="px-4 py-2.5 font-medium">Length</th>
              <th className="px-4 py-2.5 font-medium">Theme</th>
              <th className="px-4 py-2.5 font-medium">State</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id} className="h-12 border-t border-separator hover:bg-fill/50">
                <td className="max-w-md px-4 py-2">
                  <Link href={`/videos/${v.id}`} className="font-medium text-label hover:text-accent">{v.title ?? v.id}</Link>
                </td>
                <td className="px-4 py-2 text-label-2">{v.channel ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums text-label-2">{v.durationS != null ? formatTimestamp(v.durationS) : "—"}</td>
                <td className="px-4 py-2">
                  {v.themeId ? (
                    <Link href={`/themes/${v.themeId}`} className="text-label-2 hover:text-accent">{v.themePath}</Link>
                  ) : (
                    <span className="text-label-3">—</span>
                  )}
                </td>
                <td className="px-4 py-2"><StateBadge state={v.state} themeSource={v.themeSource} /></td>
                <td className="px-4 py-2 text-right tabular-nums text-label-2">{formatUsd(v.costMicrousd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card rows md:hidden">
        {videos.map((v) => (
          <Link key={v.id} href={`/videos/${v.id}`} className="block px-4 py-3 hover:bg-fill/50">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-label">{v.title ?? v.id}</p>
              <StateBadge state={v.state} themeSource={v.themeSource} />
            </div>
            <p className="subhead mt-0.5">
              {v.channel ?? "—"} · {v.durationS != null ? formatTimestamp(v.durationS) : "—"} · {v.themeId ? v.themePath : "—"}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
