import Link from "next/link";
import { formatUsd } from "@/lib/costs.mjs";
import { formatTimestamp } from "@/lib/youtube/timestamps.mjs";
import StateBadge from "./StateBadge";

export default function VideosTable({ videos, empty = "No video here yet. Paste links above to start." }) {
  if (!videos.length) return <p className="mt-8 text-sm text-neutral-500">{empty}</p>;
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-neutral-200 text-xs text-neutral-500">
          <tr>
            <th className="px-3 py-2 font-medium">Video</th>
            <th className="px-3 py-2 font-medium">Channel</th>
            <th className="px-3 py-2 font-medium">Length</th>
            <th className="px-3 py-2 font-medium">Theme</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id} className="border-b border-neutral-100 last:border-0">
              <td className="max-w-md px-3 py-2">
                <Link href={`/videos/${v.id}`} className="font-medium hover:underline">{v.title ?? v.id}</Link>
              </td>
              <td className="px-3 py-2 text-neutral-600">{v.channel ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-600">{v.durationS != null ? formatTimestamp(v.durationS) : "—"}</td>
              <td className="px-3 py-2">
                {v.themeId ? <Link href={`/themes/${v.themeId}`} className="hover:underline">{v.themePath}</Link> : <span className="text-neutral-400">—</span>}
              </td>
              <td className="px-3 py-2"><StateBadge state={v.state} themeSource={v.themeSource} /></td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatUsd(v.costMicrousd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
