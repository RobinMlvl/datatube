const LABEL = {
  queued: "Queued", fetching: "Fetching transcript", summarizing: "Summarizing", classifying: "Sorting",
  done: "Done", no_transcript: "No transcript", failed: "Failed",
};
const TONE = { done: "bg-emerald-50 text-emerald-700", no_transcript: "bg-amber-50 text-amber-800", failed: "bg-red-50 text-red-700" };

export default function StateBadge({ state, themeSource }) {
  const review = state === "done" && themeSource === "proposed";
  const label = review ? "To review" : LABEL[state] ?? state;
  const tone = review ? "bg-blue-50 text-blue-700" : TONE[state] ?? "bg-neutral-100 text-neutral-700";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}
