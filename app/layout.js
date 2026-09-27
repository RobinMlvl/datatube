import Link from "next/link";
import { connection } from "next/server";
import "./globals.css";
import ThemeTree from "@/components/ThemeTree";
import { getDb } from "@/lib/db.mjs";
import { libraryCounts, themeTree } from "@/lib/queries.mjs";

export const metadata = { title: "DataTube", description: "A knowledge library built from YouTube videos." };

function SideLink({ href, label, count = null, strong = false }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-neutral-100">
      <span className={strong ? "font-medium" : ""}>{label}</span>
      {count != null && <span className="tabular-nums text-neutral-500">{count}</span>}
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
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="shrink-0 border-b border-neutral-200 bg-white px-4 py-5 md:w-64 md:border-b-0 md:border-r">
            <Link href="/" className="px-2 text-lg font-semibold tracking-tight">DataTube</Link>
            <nav className="mt-5 space-y-1 text-sm">
              <SideLink href="/" label="Library" count={counts.total} />
              <SideLink href="/review" label="To review" count={counts.review} strong={counts.review > 0} />
              <SideLink href="/settings" label="Settings" />
            </nav>
            <p className="mt-6 px-2 text-xs font-medium text-neutral-500">Themes</p>
            <ThemeTree tree={tree} />
          </aside>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
