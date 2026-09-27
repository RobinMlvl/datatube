"use client";

import { useState, useTransition } from "react";

export default function ActionButton({ action, label, pendingLabel = "Working…", variant = "secondary" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const style = variant === "primary" ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white hover:bg-neutral-50";
  const run = () => start(async () => {
    setError(null);
    const result = await action();
    if (!result?.ok) setError(result?.error ?? "Something went wrong.");
  });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={run} className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${style}`}>
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </span>
  );
}
