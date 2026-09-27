"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db.mjs";
import { createLivePipeline } from "@/lib/pipeline/live.mjs";
import { buildThemeSheet, saveThemeSheet } from "@/lib/pipeline/themeSheet.mjs";
import { getTheme, themeVideosWithSummaries } from "@/lib/queries.mjs";
import { readSettings } from "@/lib/settings.mjs";
import { deleteTheme, renameTheme, setThemeParent } from "@/lib/themes.mjs";

const ThemeId = z.number().int().positive();
const fail = (err) => ({ ok: false, error: err?.issues ? "Invalid input." : String(err?.message ?? err).slice(0, 300) });

export async function regenerateThemeSheetAction(themeId) {
  try {
    const id = ThemeId.parse(themeId);
    const db = getDb();
    const theme = getTheme(db, id);
    if (!theme) return { ok: false, error: "Unknown theme." };
    const { deepseekModel } = readSettings(db);
    const { deepseek } = createLivePipeline(db);
    const markdown = await buildThemeSheet({
      path: theme.path, videos: themeVideosWithSummaries(db, id), model: deepseekModel, themeId: id,
      complete: (args) => deepseek({ ...args, themeId: id }),
    });
    saveThemeSheet(db, id, markdown, deepseekModel, Date.now(), { seenChanges: theme.changesSinceSheet });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function renameThemeAction(themeId, name) {
  try {
    renameTheme(getDb(), ThemeId.parse(themeId), z.string().trim().min(1).max(60).parse(name));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setThemeParentAction(themeId, parentId) {
  try {
    setThemeParent(getDb(), ThemeId.parse(themeId), ThemeId.nullable().parse(parentId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteThemeAction(themeId) {
  try {
    deleteTheme(getDb(), ThemeId.parse(themeId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
