"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db.mjs";
import { importInput } from "@/lib/importer.mjs";
import { listEntries, runYtDlp } from "@/lib/youtube/ytdlp.mjs";

const ImportForm = z.object({ input: z.string().trim().min(1, "Paste at least one link.").max(20_000, "That is too much text at once.") });

export async function importAction(_prev, formData) {
  const parsed = ImportForm.safeParse({ input: formData.get("input") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const result = await importInput(getDb(), parsed.data.input, { listEntries: (url) => listEntries(url, { run: runYtDlp }), now: Date.now });
    revalidatePath("/", "layout");
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) };
  }
}
