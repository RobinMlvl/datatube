// Markdown files to hand to an AI: every file says where its knowledge comes from.
import { formatTimestamp } from "./youtube/timestamps.mjs";

export function slug(text) {
  return String(text ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

export function frontMatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v : JSON.stringify(String(v))}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export function videoSheetFile({ video, summary, themePath, model }) {
  return {
    filename: `${slug(video.title)}-${video.id}.md`,
    content: `${frontMatter({
      source: watchUrl(video.id),
      title: video.title,
      channel: video.channel,
      published: video.publishedAt,
      duration: video.durationS != null ? formatTimestamp(video.durationS) : null,
      language: video.language,
      theme: themePath,
      generated_by: `DataTube · ${model}`,
    })}\n${summary}`,
  };
}

export function themeSheetFile({ path, sheetMarkdown, model, generatedAt, videoCount }) {
  return {
    filename: `${slug(path)}.md`,
    content: `${frontMatter({ theme: path, videos: videoCount, generated_at: generatedAt, generated_by: `DataTube · ${model}` })}\n${sheetMarkdown}`,
  };
}

export function themeBundleFile({ path, sheetMarkdown, model, generatedAt, videos }) {
  const head = frontMatter({ theme: path, videos: videos.length, generated_at: generatedAt, generated_by: `DataTube · ${model}` });
  const sheet = sheetMarkdown ?? `# ${path}\n\nNo consolidated sheet yet — regenerate it in DataTube.\n`;
  const parts = videos.map(({ video, summary }) => `\n\n---\n\n<!-- source: ${watchUrl(video.id)} -->\n${summary}`);
  return { filename: `${slug(path)}-bundle.md`, content: `${head}\n${sheet}${parts.join("")}\n` };
}
