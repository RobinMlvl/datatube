"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteThemeAction, renameThemeAction, setThemeParentAction } from "@/app/actions/themes";

const BUTTON = "rounded-md border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50";
const FIELD = "rounded-md border border-neutral-300 px-2 py-1.5";

export default function ThemeAdmin({ theme, parents, canHaveParent, canDelete }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [name, setName] = useState(theme.name);
  const [parentId, setParentId] = useState(theme.parentId ? String(theme.parentId) : "");
  const run = (fn, after) => start(async () => {
    setError(null);
    const result = await fn();
    if (!result?.ok) setError(result?.error ?? "Something went wrong.");
    else after?.();
  });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} w-56`} />
        <button type="button" disabled={pending || !name.trim() || name === theme.name} onClick={() => run(() => renameThemeAction(theme.id, name))} className={BUTTON}>Rename</button>
      </div>
      {canHaveParent && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={FIELD}>
            <option value="">No parent</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" disabled={pending} onClick={() => run(() => setThemeParentAction(theme.id, parentId ? Number(parentId) : null))} className={BUTTON}>Set parent</button>
        </div>
      )}
      {canDelete && (
        <button type="button" disabled={pending} onClick={() => run(() => deleteThemeAction(theme.id), () => router.push("/"))} className={BUTTON}>Delete this empty theme</button>
      )}
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
