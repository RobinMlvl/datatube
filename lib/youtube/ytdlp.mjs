// Everything that touches YouTube goes through yt-dlp — the tool the ytquest profile proved.
// From Robin's home IP no cookie is needed; `deno` must be installed (yt-dlp solves YouTube's
// JS challenges with it). The process runner is always injected: tests never spawn yt-dlp.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { canonicalVideoUrl, videoIdOf } from "./urls.mjs";

export class YtDlpError extends Error {
  constructor(message, { rateLimited = false, unavailable = false, missing = false } = {}) {
    super(message);
    this.name = "YtDlpError";
    this.rateLimited = rateLimited;
    this.unavailable = unavailable;
    this.missing = missing;
  }
}

export function classifyError(err, stderr = "") {
  if (err?.code === "ENOENT") {
    return new YtDlpError("yt-dlp is not installed — run: brew install yt-dlp deno", { missing: true });
  }
  const text = `${stderr}\n${err?.message ?? ""}`;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const message = (lines.filter((l) => l.startsWith("ERROR:")).at(-1) ?? lines.at(-1) ?? "yt-dlp failed").slice(0, 500);
  return new YtDlpError(message, {
    rateLimited: /HTTP Error 429|Too Many Requests/i.test(text),
    unavailable: /Video unavailable|Private video|has been removed|members-only|confirm your age/i.test(text),
  });
}

export function runYtDlp(args, { bin = process.env.YTDLP_BIN?.trim() || "yt-dlp", timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) reject(classifyError(err, String(stderr ?? "")));
      else resolve(String(stdout));
    });
  });
}

const HIDDEN = /^\[(Private|Deleted) video\]$/;

export function entriesOf(json) {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.entries)) { node.entries.forEach(walk); return; }
    if (node.ie_key && node.ie_key !== "Youtube") return;
    const id = videoIdOf(node.id ?? "") ?? videoIdOf(node.url ?? "");
    const title = typeof node.title === "string" ? node.title : null;
    if (id && !(title && HIDDEN.test(title))) out.push({ videoId: id, title });
  };
  walk(json);
  return out;
}

export async function listEntries(url, { run }) {
  return entriesOf(JSON.parse(await run(["--flat-playlist", "-J", "--no-warnings", url])));
}

const str = (v) => (typeof v === "string" && v.trim() ? v : null);

export function metadataOf(json) {
  const date = str(json?.upload_date)?.match(/^(\d{4})(\d{2})(\d{2})$/);
  return {
    videoId: json?.id ?? null,
    title: str(json?.title),
    channel: str(json?.channel) ?? str(json?.uploader),
    channelId: str(json?.channel_id),
    durationS: Number.isFinite(json?.duration) ? Math.round(json.duration) : null,
    publishedAt: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
    chapters: Array.isArray(json?.chapters)
      ? json.chapters.filter((c) => Number.isFinite(c?.start_time)).map((c) => ({ startS: Math.floor(c.start_time), title: str(c.title) ?? "" }))
      : [],
    language: str(json?.language),
    subtitles: Object.keys(json?.subtitles ?? {}).filter((k) => k !== "live_chat"),
    automaticCaptions: Object.keys(json?.automatic_captions ?? {}),
  };
}

export async function fetchMetadata(videoId, { run }) {
  return metadataOf(JSON.parse(await run(["-J", "--skip-download", "--no-warnings", canonicalVideoUrl(videoId)])));
}

const base = (code) => String(code).split("-")[0].toLowerCase();

// The spoken words first: manual then auto in the original language; French or English manual
// subtitles next; French/English auto only when the original language is unknown (otherwise
// they are machine translations of the spoken words).
export function trackCandidates(meta) {
  const manual = meta?.subtitles ?? [];
  const auto = meta?.automaticCaptions ?? [];
  const origAuto = auto.find((k) => k.endsWith("-orig")) ?? null;
  const orig = meta?.language ? base(meta.language) : origAuto ? base(origAuto) : null;
  const out = [];
  const add = (lang, kind) => {
    if (lang && !out.some((t) => t.lang === lang && t.kind === kind)) out.push({ lang, kind });
  };
  const manualIn = (l) => manual.find((k) => k.toLowerCase() === l) ?? manual.find((k) => base(k) === l);
  const autoIn = (l) => auto.find((k) => k === `${l}-orig`) ?? auto.find((k) => k.toLowerCase() === l);
  if (orig) {
    add(manualIn(orig), "manual");
    add(autoIn(orig), "auto");
  }
  add(manualIn("fr"), "manual");
  add(manualIn("en"), "manual");
  if (!orig) {
    add(autoIn("fr"), "auto");
    add(autoIn("en"), "auto");
  }
  add(manual[0], "manual");
  add(origAuto, "auto");
  return out;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function downloadSubtitle(videoId, track, { run }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "datatube-"));
  try {
    await run([
      "--skip-download",
      track.kind === "manual" ? "--write-subs" : "--write-auto-subs",
      "--sub-langs", `^${escapeRegex(track.lang)}$`,
      "--sub-format", "vtt",
      "--no-warnings",
      "-o", path.join(dir, "%(id)s.%(ext)s"),
      canonicalVideoUrl(videoId),
    ]);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".vtt"));
    const file = files.find((f) => f.endsWith(`.${track.lang}.vtt`)) ?? files[0];
    return file ? await fs.readFile(path.join(dir, file), "utf8") : null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const execVersion = (bin) => new Promise((resolve, reject) => {
  execFile(bin, ["--version"], { timeout: 10_000 }, (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
});

export async function checkTools({ exec = execVersion } = {}) {
  const version = async (bin) => {
    try { return (await exec(bin)).split("\n")[0].trim() || null; } catch { return null; }
  };
  return { ytDlp: await version(process.env.YTDLP_BIN?.trim() || "yt-dlp"), deno: await version("deno") };
}
