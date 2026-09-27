"use client";

import { useState, useTransition } from "react";
import { moveVideoAction, moveVideoToNewThemeAction } from "@/app/actions/videos";

const BUTTON = "rounded-md border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50";
const FIELD = "rounded-md border border-neutral-300 px-2 py-1.5";

export default function ThemePicker({ videoId, themes, currentThemeId }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [choice, setChoice] = useState(currentThemeId ? String(currentThemeId) : "");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const run = (fn) => start(async () => {
    setError(null);
    const result = await fn();
    if (!result?.ok) setError(result?.error ?? "Something went wrong.");
    else { setName(""); setParent(""); }
  });
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={FIELD}>
          <option value="">No theme</option>
          {themes.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
        </select>
        <button type="button" disabled={pending} onClick={() => run(() => moveVideoAction(videoId, choice ? Number(choice) : null))} className={BUTTON}>Move</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Parent (optional)" className={`${FIELD} w-40`} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New theme" className={`${FIELD} w-48`} />
        <button type="button" disabled={pending || !name.trim()} onClick={() => run(() => moveVideoToNewThemeAction(videoId, { name, parent: parent.trim() || null }))} className={BUTTON}>
          Create and move
        </button>
      </div>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
