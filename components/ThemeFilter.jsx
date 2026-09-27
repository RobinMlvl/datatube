"use client";

import { useRouter } from "next/navigation";

// The Library's theme filter: a popup that keeps the state filter and the search in the URL.
export default function ThemeFilter({ themes, themeId, state, q }) {
  const router = useRouter();
  const go = (value) => {
    const p = new URLSearchParams();
    if (value) p.set("theme", value);
    if (state) p.set("state", state);
    if (q) p.set("q", q);
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  };
  return (
    <select aria-label="Filter by theme" value={themeId ?? ""} onChange={(e) => go(e.target.value)} className="field w-full md:w-56">
      <option value="">All themes</option>
      {themes.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
    </select>
  );
}
