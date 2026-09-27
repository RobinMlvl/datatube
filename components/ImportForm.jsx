"use client";

import { useActionState } from "react";
import { importAction } from "@/app/actions/library";

export default function ImportForm() {
  const [state, formAction, pending] = useActionState(importAction, null);
  return (
    <form action={formAction} className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
      <label htmlFor="input" className="text-sm font-medium">Add videos</label>
      <p className="text-xs text-neutral-500">One per line: a video, a playlist or a channel.</p>
      <textarea
        id="input" name="input" rows={4} required
        className="mt-2 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm"
        placeholder={"https://www.youtube.com/watch?v=…\nhttps://www.youtube.com/playlist?list=…\nhttps://www.youtube.com/@channel"}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Reading the links…" : "Import"}
        </button>
        {state?.ok && (
          <p className="text-sm text-neutral-600">
            {state.imported} imported · {state.skipped} already in the library
            {state.invalid.length ? ` · ${state.invalid.length} line(s) not recognised` : ""}
          </p>
        )}
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
      {state?.errors?.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-red-700">
          {state.errors.map((e) => <li key={e.input}>{e.input} — {e.message}</li>)}
        </ul>
      )}
    </form>
  );
}
