"use client";

import { useState, useTransition } from "react";

const VARIANT = { primary: "btn-primary", secondary: "btn-secondary", destructive: "btn-destructive" };

// icon is an optional element rendered before the label, e.g. icon={<RefreshCw aria-hidden="true" />}
// (an element, not a component: Server Components can only pass serializable props).
export default function ActionButton({ action, label, pendingLabel = "Working…", variant = "secondary", icon = null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const run = () => start(async () => {
    setError(null);
    const result = await action();
    if (!result?.ok) setError(result?.error ?? "Something went wrong.");
  });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={run} className={`btn ${VARIANT[variant] ?? VARIANT.secondary}`}>
        {icon}
        {pending ? pendingLabel : label}
      </button>
      {error && <span role="alert" className="text-[13px] text-negative">{error}</span>}
    </span>
  );
}
