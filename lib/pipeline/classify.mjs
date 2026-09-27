// Jev picks a theme among the existing ones, with a calibrated probability; under the threshold,
// or when « none » wins, DeepSeek proposes a name and the video waits in Review.
import { z } from "zod";
import { LlmError } from "../llm/errors.mjs";
import { choiceOf } from "../llm/jev.mjs";
import { iso } from "../time.mjs";
import { assignVideo, findThemeByPath, listThemes, recentTitlesByTheme, themePath } from "../themes.mjs";
import { sectionText } from "./markdown.mjs";
import { PROPOSAL_SYSTEM, proposalUser } from "./prompts.mjs";

const STATE_CHARS = 6000;

export function classifyState(video, summary) {
  const excerpt = [sectionText(summary, "## 🎯 Core idea"), sectionText(summary, "## 💡 Key points")]
    .filter(Boolean).join("\n\n").slice(0, STATE_CHARS);
  return { video: { title: video.title ?? null, channel: video.channel ?? null }, summary: excerpt };
}

export function buildThemeQuestion(themes, samples = new Map()) {
  const byId = new Map(themes.map((t) => [t.id, t]));
  const criteria = {};
  for (const t of themes) {
    const titles = (samples.get(t.id) ?? []).map((s) => `"${s}"`).join("; ");
    criteria[`t${t.id}`] = `The theme "${themePath(t, byId)}".${titles ? ` Videos already in it: ${titles}.` : ""}`;
  }
  criteria.none = "None of the themes above fits the main subject of the video.";
  return {
    theme: {
      type: "choice",
      instructions: "Which theme best matches the main subject of `video`, judging by its `title`, `channel` and `summary`?",
      criteria,
    },
  };
}

export function decideTheme(answer, { thresholdPermille }) {
  if (!answer) return { themeId: null, confidencePermille: null };
  const p = answer.p || (Number.isFinite(answer.confidence) ? answer.confidence : 0);
  const confidencePermille = Math.max(0, Math.min(1000, Math.round(p * 1000)));
  const match = /^t(\d+)$/.exec(answer.choice ?? "");
  if (!match || confidencePermille < thresholdPermille) return { themeId: null, confidencePermille };
  return { themeId: Number(match[1]), confidencePermille };
}

const Proposal = z.object({
  name: z.string().trim().min(1).max(60),
  parent: z.string().trim().min(1).max(60).nullable().optional(),
});

export function parseProposal(text) {
  let json;
  try { json = JSON.parse(text); } catch { throw new LlmError("The theme proposal was not JSON", "bad_format"); }
  const parsed = Proposal.safeParse(json);
  if (!parsed.success) throw new LlmError("The theme proposal has no usable name", "bad_format");
  const { name, parent } = parsed.data;
  return { name, parent: parent && parent.toLowerCase() !== name.toLowerCase() ? parent : null };
}

export async function classifyVideo({ db, video, summary, model, thresholdPermille, jev, complete }) {
  const themes = listThemes(db);
  const byId = new Map(themes.map((t) => [t.id, t]));
  const state = classifyState(video, summary);
  let confidencePermille = null;
  if (themes.length) {
    const answers = await jev({ state, questions: buildThemeQuestion(themes, recentTitlesByTheme(db)), feature: "classify" });
    const decision = decideTheme(choiceOf(answers, "theme"), { thresholdPermille });
    if (decision.themeId && byId.has(decision.themeId)) {
      return { kind: "auto", themeId: decision.themeId, confidencePermille: decision.confidencePermille };
    }
    confidencePermille = decision.confidencePermille;
  }
  const { text } = await complete({
    model, system: PROPOSAL_SYSTEM, json: true, maxTokens: 200, feature: "theme_proposal",
    user: proposalUser(video, state.summary, themes.map((t) => themePath(t, byId))),
  });
  const proposal = parseProposal(text);
  const existing = findThemeByPath(db, proposal.name, proposal.parent);
  if (existing) return { kind: "auto", themeId: existing.id, confidencePermille };
  return { kind: "proposed", proposal, confidencePermille };
}

export function applyClassification(db, videoId, result, now) {
  if (result.kind === "auto") {
    assignVideo(db, videoId, result.themeId, "auto", now);
    db.prepare("UPDATE Video SET classifyConfidence = ? WHERE id = ?").run(result.confidencePermille, videoId);
    return;
  }
  db.transaction(() => {
    assignVideo(db, videoId, null, null, now);
    db.prepare("UPDATE Video SET themeSource = 'proposed', proposedTheme = ?, classifyConfidence = ?, updatedAt = ? WHERE id = ?")
      .run(JSON.stringify(result.proposal), result.confidencePermille, iso(now), videoId);
  })();
}
