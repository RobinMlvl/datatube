// The last 30 days of spend, as a quiet inline bar chart — one series (cost), no axis, no
// legend: the card title already says what is plotted. Bars scale to the busiest day in the
// window; a day with no calls is a 1px hairline stub, kept visually distinct from a real but
// tiny amount (which gets a 3px floor so it never disappears next to a much larger day).
import { formatUsdPrecise } from "@/lib/costs.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// `day` is a plain "YYYY-MM-DD" local-calendar key (see lib/time.mjs) — read as text, never
// through `new Date(...)`, so no runtime timezone can shift it by a day.
function formatDayLabel(day) {
  const [, month, date] = day.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(date)}`;
}

export default function SpendBars({ days }) {
  const max = days.reduce((m, d) => Math.max(m, d.costMicrousd), 0);
  if (max === 0) {
    return <p className="subhead">No spend in the last 30 days.</p>;
  }
  const barHeight = (cost) => (cost === 0 ? 1 : Math.max(3, Math.round((cost / max) * 128)));
  const first = days[0];
  const middle = days[Math.floor((days.length - 1) / 2)];
  const last = days[days.length - 1];
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]">
        {days.map((d) => {
          const label = `${formatDayLabel(d.day)} · ${formatUsdPrecise(d.costMicrousd)}`;
          return (
            <div
              key={d.day}
              role="img"
              title={label}
              aria-label={label}
              className={`min-w-0 flex-1 rounded-t-[2px] ${d.costMicrousd > 0 ? "bg-accent" : "bg-separator"}`}
              style={{ height: `${barHeight(d.costMicrousd)}px` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="subhead">{formatDayLabel(first.day)}</p>
        <p className="subhead">{formatDayLabel(middle.day)}</p>
        <p className="subhead">{formatDayLabel(last.day)}</p>
      </div>
    </div>
  );
}
