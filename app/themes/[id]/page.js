import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft, Download, FileStack, Folder, RefreshCw } from "lucide-react";
import { regenerateThemeSheetAction } from "@/app/actions/themes";
import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import Markdown from "@/components/Markdown";
import ThemeAdmin from "@/components/ThemeAdmin";
import VideosTable from "@/components/VideosTable";
import { getDb } from "@/lib/db.mjs";
import { themeSheetFile } from "@/lib/export.mjs";
import { getTheme, themeTree, themeVideosWithSummaries } from "@/lib/queries.mjs";

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
  const sheetDate = theme.sheetGeneratedAt
    ? new Date(theme.sheetGeneratedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : null;
  const statusClass = !theme.sheetGeneratedAt ? "status-idle" : theme.changesSinceSheet ? "status-caution" : "status-done";
  const statusText = !theme.sheetGeneratedAt
    ? "No consolidated sheet yet."
    : theme.changesSinceSheet
      ? `Out of date — ${theme.changesSinceSheet} change${theme.changesSinceSheet === 1 ? "" : "s"} since · Sheet of ${sheetDate}`
      : `Up to date · Sheet of ${sheetDate}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="btn btn-plain -ml-2">
        <ChevronLeft aria-hidden="true" />
        Library
      </Link>
      <h1 className="large-title mt-3">{theme.path}</h1>
      <p className={`status ${statusClass} mt-2`}>{statusText}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {summarized > 0
          ? (
            <ActionButton
              action={regenerateThemeSheetAction.bind(null, theme.id)}
              label={theme.sheetMarkdown ? "Regenerate sheet" : "Write the sheet"}
              pendingLabel="Writing the sheet…"
              variant="primary"
              icon={RefreshCw}
            />
          )
          : <span className="subhead">No summarized video in this theme yet.</span>}
        {file && <CopyButton text={file.content} />}
        {file && (
          <a href={`/api/export/theme/${theme.id}`} className="btn btn-secondary">
            <Download aria-hidden="true" />
            Download .md
          </a>
        )}
        {summarized > 0 && (
          <a href={`/api/export/theme/${theme.id}?bundle=1`} className="btn btn-secondary">
            <FileStack aria-hidden="true" />
            Download with all video sheets
          </a>
        )}
      </div>
      {theme.children.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {theme.children.map((c) => (
            <Link key={c.id} href={`/themes/${c.id}`} className="btn btn-secondary">
              <Folder aria-hidden="true" />
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {theme.sheetMarkdown && (
        <article className="card mt-6 p-5 md:p-8">
          <Markdown markdown={theme.sheetMarkdown.replace(/^# [^\n]*\n+/, "")} />
        </article>
      )}
      <h2 className="title-2 mt-10 mb-3">Videos</h2>
      <VideosTable videos={theme.videos} empty="No video filed directly in this theme." />
      <h2 className="title-2 mt-10 mb-3">Manage</h2>
      <ThemeAdmin
        theme={{ id: theme.id, name: theme.name, parentId: theme.parentId }}
        parents={parents}
        canHaveParent={theme.children.length === 0}
        canDelete={theme.children.length === 0 && theme.videos.length === 0}
      />
    </div>
  );
}
