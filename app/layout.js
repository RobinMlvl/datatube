import Link from "next/link";
import { connection } from "next/server";
import { ChevronDown, Library } from "lucide-react";
import "./globals.css";
import SidebarNav from "@/components/SidebarNav";
import ThemeTree from "@/components/ThemeTree";
import { getDb } from "@/lib/db.mjs";
import { libraryCounts, themeTree } from "@/lib/queries.mjs";

export const metadata = { title: "DataTube", description: "A knowledge library built from YouTube videos." };

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent">
        <Library className="h-[13px] w-[13px] text-white" />
      </span>
      <span className="headline">DataTube</span>
    </Link>
  );
}

export default async function RootLayout({ children }) {
  await connection();
  const db = getDb();
  const counts = libraryCounts(db);
  const tree = themeTree(db);

  return (
    <html lang="en">
      <body className="bg-bg text-label antialiased">
        <div className="sticky top-0 z-20 border-b border-separator bg-[var(--sidebar)] px-4 backdrop-blur-xl md:hidden">
          <div className="flex h-14 items-center">
            <Wordmark />
          </div>
          <SidebarNav counts={counts} variant="mobile" />
          <details className="group pb-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex list-none items-center justify-between px-2 py-2">
              <span className="eyebrow">Themes</span>
              <ChevronDown className="h-4 w-4 text-label-2 transition-transform group-open:rotate-180" />
            </summary>
            <ThemeTree tree={tree} />
          </details>
        </div>
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-separator bg-[var(--sidebar)] px-3 py-5 backdrop-blur-xl md:block">
            <Wordmark />
            <div className="mt-5">
              <SidebarNav counts={counts} variant="desktop" />
            </div>
            <p className="eyebrow mt-6 mb-1 px-2">Themes</p>
            <ThemeTree tree={tree} />
          </aside>
          <main className="min-w-0 flex-1 px-4 pb-16 pt-6 md:px-10 md:pt-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
