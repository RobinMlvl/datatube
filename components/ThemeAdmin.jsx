"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteThemeAction, renameThemeAction, setThemeParentAction } from "@/app/actions/themes";

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
    <div className="card">
      <div className="rows">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="w-24 text-[13px] text-label-2">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Theme name"
            className="field w-56"
          />
          <button
            type="button"
            disabled={pending || !name.trim() || name === theme.name}
            onClick={() => run(() => renameThemeAction(theme.id, name))}
            className="btn btn-secondary"
          >
            Rename
          </button>
        </div>
        {canHaveParent && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-24 text-[13px] text-label-2">Parent</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              aria-label="Parent theme"
              className="field"
            >
              <option value="">No parent</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setThemeParentAction(theme.id, parentId ? Number(parentId) : null))}
              className="btn btn-secondary"
            >
              Set parent
            </button>
          </div>
        )}
        {canDelete && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-24 text-[13px] text-label-2">Delete</span>
            <span className="subhead">Only an empty theme can be deleted.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteThemeAction(theme.id), () => router.push("/"))}
              className="btn btn-destructive"
            >
              <Trash2 aria-hidden="true" />
              Delete theme
            </button>
          </div>
        )}
        {error && <p className="px-4 py-3 text-[13px] text-negative" role="alert">{error}</p>}
      </div>
    </div>
  );
}
