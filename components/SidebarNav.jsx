"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LibraryBig, Settings } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Library", icon: LibraryBig },
  { href: "/review", label: "To review", icon: Inbox, countKey: "review" },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SidebarNav({ counts, variant = "desktop" }) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav aria-label="Primary" className="flex gap-1 overflow-x-auto pb-2">
        {ITEMS.map(({ href, label, countKey }) => {
          const active = isActive(pathname, href);
          const count = countKey ? counts[countKey] : null;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className="segment shrink-0">
              {label}
              {count != null && (
                <span className={`tabular-nums ${count > 0 ? "font-medium text-accent" : "text-label-2"}`}>{count}</span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className="space-y-0.5 text-[13px]">
      {ITEMS.map(({ href, label, icon: Icon, countKey }) => {
        const active = isActive(pathname, href);
        const count = countKey ? counts[countKey] : null;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-8 items-center gap-2 rounded-md px-2 hover:bg-fill ${active ? "bg-fill-2 font-medium" : ""}`}
          >
            <Icon className="h-4 w-4 shrink-0 text-accent" />
            <span>{label}</span>
            {count != null && (
              <span className={`ml-auto tabular-nums ${count > 0 ? "font-medium text-accent" : "text-label-2"}`}>{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
