"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db.mjs";
import { regenerateSummary, retryVideo } from "@/lib/pipeline/requeue.mjs";
import { acceptProposal, assignVideo } from "@/lib/themes.mjs";

const VideoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const ThemeName = z.object({ name: z.string().trim().min(1).max(60), parent: z.string().trim().max(60).nullable().optional() });

async function act(videoId, fn) {
  try {
    const id = VideoId.parse(videoId);
    const result = fn(getDb(), id);
    revalidatePath("/", "layout");
    return { ok: true, ...(result && typeof result === "object" ? { themeId: result.id } : {}) };
  } catch (err) {
    return { ok: false, error: err?.issues ? "Invalid input." : String(err?.message ?? err).slice(0, 300) };
  }
}

export async function moveVideoAction(videoId, themeId) {
  const parsed = z.number().int().positive().nullable().safeParse(themeId);
  if (!parsed.success) return { ok: false, error: "Invalid theme." };
  return act(videoId, (db, id) => assignVideo(db, id, parsed.data, "manual", Date.now()));
}

export async function moveVideoToNewThemeAction(videoId, input) {
  const parsed = ThemeName.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give the theme a name (60 characters at most)." };
  return act(videoId, (db, id) => acceptProposal(db, id, { name: parsed.data.name, parent: parsed.data.parent || null }, Date.now()));
}

export async function acceptProposalAction(videoId, input) {
  return moveVideoToNewThemeAction(videoId, input);
}

export async function retryVideoAction(videoId) {
  return act(videoId, (db, id) => retryVideo(db, id, Date.now()));
}

export async function regenerateSummaryAction(videoId) {
  return act(videoId, (db, id) => regenerateSummary(db, id, Date.now()));
}
