"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { importAction } from "@/app/actions/library";

export default function ImportForm() {
  const [state, formAction, pending] = useActionState(importAction, null);
  return (
    <form action={formAction} className="card mt-6 p-4">
      <label htmlFor="input" className="headline">Add videos</label>
      <p className="subhead mt-0.5">One link per line — a video, a playlist or a channel.</p>
      <textarea
        id="input" name="input" rows={4} required
        className="field mt-2 w-full font-mono text-[13px]"
        placeholder={"https://www.youtube.com/watch?v=…\nhttps://www.youtube.com/playlist?list=…\nhttps://www.youtube.com/@channel"}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          {state?.ok && (
            <p className="flex items-center gap-1.5 text-[13px] text-label-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" />
              {state.imported} imported · {state.skipped} already in the library
              {state.invalid.length ? ` · ${state.invalid.length} line${state.invalid.length > 1 ? "s" : ""} not recognised` : ""}
            </p>
          )}
          {state && !state.ok && (
            <p className="flex items-center gap-1.5 text-[13px] text-negative">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          <Plus />
          {pending ? "Reading links…" : "Import"}
        </button>
      </div>
      {state?.errors?.length > 0 && (
        <ul className="rows mt-3 text-[13px]">
          {state.errors.map((e) => (
            <li key={e.input} className="py-1.5 text-negative">{e.input} — {e.message}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
