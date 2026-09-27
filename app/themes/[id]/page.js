import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { regenerateThemeSheetAction } from "@/app/actions/themes";
import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import Markdown from "@/components/Markdown";
import ThemeAdmin from "@/components/ThemeAdmin";
import VideosTable from "@/components/VideosTable";
import { getDb } from "@/lib/db.mjs";
import { themeSheetFile } from "@/lib/export.mjs";
import { getTheme, themeTree, themeVideosWithSummaries } from "@/lib/queries.mjs";

const LINK = "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50";

export default async function ThemePage({ params }) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const theme = getTheme(db, Number(id));
  if (!theme) notFound();
  const summarized = themeVideosWithSummaries(db, theme.id).filter((v) => v.summary).length;
  const file = theme.sheetMarkdown
    ? themeSheetFile({ path: theme.path, sheetMarkdown: theme.sheetMarkdown, model: theme.sheetModel, generatedAt: theme.sheetGeneratedAt, videoCount: theme.videos.length })
    : null;
  const parents = themeTree(db).filter((t) => t.id !== theme.id).map(({ id: pid, name }) => ({ id: pid, name }));
  const sheetLine = theme.sheetGeneratedAt
    ? `Sheet of ${new Date(theme.sheetGeneratedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${theme.changesSinceSheet ? ` · out of date: ${theme.changesSinceSheet} change(s) since` : " · up to date"}`
    : "No consolidated sheet yet.";
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Library</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{theme.path}</h1>
      <p className={`mt-1 text-sm ${theme.changesSinceSheet && theme.sheetGeneratedAt ? "text-amber-700" : "text-neutral-500"}`}>{sheetLine}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {summarized > 0
          ? <ActionButton action={regenerateThemeSheetAction.bind(null, theme.id)} label={theme.sheetMarkdown ? "Regenerate sheet" : "Write the sheet"} pendingLabel="Writing the sheet… (up to a minute)" variant="primary" />
          : <span className="text-sm text-neutral-500">No summarized video in this theme yet.</span>}
        {file && <CopyButton text={file.content} />}
        {file && <a href={`/api/export/theme/${theme.id}`} className={LINK}>Download .md</a>}
        {summarized > 0 && <a href={`/api/export/theme/${theme.id}?bundle=1`} className={LINK}>Download with all video sheets</a>}
      </div>
      {theme.children.length > 0 && (
        <p className="mt-4 text-sm">
          Sub-themes: {theme.children.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/themes/${c.id}`} className="underline">{c.name}</Link></span>)}
        </p>
      )}
      {theme.sheetMarkdown && <article className="mt-6 rounded-lg border border-neutral-200 bg-white p-5"><Markdown markdown={theme.sheetMarkdown} /></article>}
      <h2 className="mt-8 text-lg font-semibold">Videos</h2>
      <VideosTable videos={theme.videos} empty="No video filed directly in this theme." />
      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium">Manage</h2>
        <div className="mt-3">
          <ThemeAdmin
            theme={{ id: theme.id, name: theme.name, parentId: theme.parentId }}
            parents={parents}
            canHaveParent={theme.children.length === 0}
            canDelete={theme.children.length === 0 && theme.videos.length === 0}
          />
        </div>
      </section>
    </div>
  );
}
