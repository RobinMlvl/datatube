"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FolderInput } from "lucide-react";
import { moveVideoAction, moveVideoToNewThemeAction } from "@/app/actions/videos";

// The whole "Theme" card on the video page: the current path + how it got there, and a
// closed-by-default "Change" disclosure that moves the video (same actions as before).
export default function ThemePicker({ videoId, themes, currentThemeId, themePath, themeHref, themeLine }) {
  const [open, setOpen] = useState(false);
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
    <section className="card mt-6">
      <div className="rows">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow">Theme</p>
            {themeHref && (
              <p className="mt-1">
                <Link href={themeHref} className="font-medium hover:text-accent">{themePath}</Link>
              </p>
            )}
            <p className="subhead mt-0.5">{themeLine}</p>
          </div>
          <button type="button" className="btn btn-secondary shrink-0" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <FolderInput aria-hidden="true" />
            Change
          </button>
        </div>
        {open && (
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-24 shrink-0 text-[13px] text-label-2">Move to</span>
              <select aria-label="Move to theme" value={choice} onChange={(e) => setChoice(e.target.value)} className="field">
                <option value="">No theme</option>
                {themes.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
              </select>
              <button type="button" disabled={pending} onClick={() => run(() => moveVideoAction(videoId, choice ? Number(choice) : null))} className="btn btn-secondary">
                Move
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-24 shrink-0 text-[13px] text-label-2">New theme</span>
              <input aria-label="Parent theme (optional)" value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Parent (optional)" className="field w-40" />
              <input aria-label="New theme name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="field w-48" />
              <button type="button" disabled={pending || !name.trim()} onClick={() => run(() => moveVideoToNewThemeAction(videoId, { name, parent: parent.trim() || null }))} className="btn btn-secondary">
                Create and move
              </button>
            </div>
            {error && <p role="alert" className="text-[13px] text-negative">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
