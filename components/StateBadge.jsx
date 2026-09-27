const LABEL = {
  queued: "Queued",
  fetching: "Fetching transcript",
  summarizing: "Summarizing",
  classifying: "Sorting",
  done: "Done",
  no_transcript: "No transcript",
  failed: "Failed",
};

const TONE = {
  queued: "status-idle",
  fetching: "status-active",
  summarizing: "status-active",
  classifying: "status-active",
  done: "status-done",
  no_transcript: "status-caution",
  failed: "status-negative",
};

export default function StateBadge({ state, themeSource }) {
  const review = state === "done" && themeSource === "proposed";
  const label = review ? "To review" : (LABEL[state] ?? state);
  const tone = review ? "status-review" : (TONE[state] ?? "status-idle");
  return <span className={`status ${tone}`}>{label}</span>;
}
