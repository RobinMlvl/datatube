"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder } from "lucide-react";

function totalCount(theme) {
  return theme.videoCount + theme.children.reduce((sum, c) => sum + c.videoCount, 0);
}

function Row({ theme, active, indent = false, count }) {
  return (
    <Link
      href={`/themes/${theme.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center gap-2 rounded-md text-[13px] hover:bg-fill ${indent ? "pl-6 pr-2" : "px-2"} ${active ? "bg-fill-2 font-medium" : ""}`}
    >
      {!indent && <Folder className="h-4 w-4 shrink-0 text-label-2" />}
      <span className="truncate">{theme.name}</span>
      <span className="ml-auto shrink-0 tabular-nums text-label-2">{count}</span>
    </Link>
  );
}

export default function ThemeTree({ tree }) {
  const pathname = usePathname();
  if (!tree.length) return <p className="subhead px-2">No themes yet — they appear as videos are sorted.</p>;
  return (
    <ul className="space-y-0.5">
      {tree.map((t) => (
        <li key={t.id}>
          <Row theme={t} active={pathname === `/themes/${t.id}`} count={totalCount(t)} />
          {t.children.length > 0 && (
            <ul className="space-y-0.5">
              {t.children.map((c) => (
                <li key={c.id}>
                  <Row theme={c} active={pathname === `/themes/${c.id}`} indent count={c.videoCount} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
