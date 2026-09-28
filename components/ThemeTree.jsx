"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";

function totalCount(theme) {
  return theme.videoCount + theme.children.reduce((sum, c) => sum + c.videoCount, 0);
}

function Row({ theme, active, child = false, count }) {
  return (
    <Link
      href={`/themes/${theme.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md text-[13px] hover:bg-fill ${child ? "pl-8 pr-2" : "px-2"} ${active ? "bg-fill-2 font-medium" : ""}`}
    >
      {!child && <Folder className="h-4 w-4 shrink-0 text-label-2" />}
      <span className="truncate">{theme.name}</span>
      <span className="ml-auto shrink-0 tabular-nums text-label-2">{count}</span>
    </Link>
  );
}

// Sub-themes fold under their parent, Finder style: closed by default, open around the theme being
// viewed. The choice holds while the app is open — the sidebar lives in the root layout.
export default function ThemeTree({ tree }) {
  const pathname = usePathname();
  const [open, setOpen] = useState({}); // parent id → what the user chose; unset = follow the page
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    // Arriving on a sub-theme opens its parent, even one folded before: the current page stays visible.
    setSeenPath(pathname);
    const parent = tree.find((t) => t.children.some((c) => pathname === `/themes/${c.id}`));
    if (parent && open[parent.id] === false) setOpen((o) => ({ ...o, [parent.id]: true }));
  }
  if (!tree.length) return <p className="subhead px-2">No themes yet — they appear as videos are sorted.</p>;
  return (
    <ul className="space-y-0.5">
      {tree.map((t) => {
        const hasChildren = t.children.length > 0;
        const expanded = open[t.id] ?? t.children.some((c) => pathname === `/themes/${c.id}`);
        return (
          <li key={t.id}>
            <div className="flex items-center">
              {hasChildren ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`subthemes-${t.id}`}
                  aria-label={`${expanded ? "Hide" : "Show"} the sub-themes of ${t.name}`}
                  onClick={() => setOpen((o) => ({ ...o, [t.id]: !expanded }))}
                  className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-label-2 hover:bg-fill"
                >
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="w-6 shrink-0" aria-hidden="true" />
              )}
              <Row theme={t} active={pathname === `/themes/${t.id}`} count={totalCount(t)} />
            </div>
            {hasChildren && expanded && (
              <ul id={`subthemes-${t.id}`} className="ml-6 space-y-0.5">
                {t.children.map((c) => (
                  <li key={c.id} className="flex">
                    <Row theme={c} active={pathname === `/themes/${c.id}`} child count={c.videoCount} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
