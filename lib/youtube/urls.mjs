// What Robin pastes: one link per line — a video, a playlist or a channel.
const ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "youtube-nocookie.com"]);

function toUrl(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  try { return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
}
const hostOf = (url) => url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");

export const canonicalVideoUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export function videoIdOf(input) {
  const s = String(input ?? "").trim();
  if (ID.test(s)) return s;
  const url = toUrl(s);
  if (!url) return null;
  const host = hostOf(url);
  if (host === "youtu.be") {
    const id = url.pathname.slice(1, 12);
    return ID.test(id) ? id : null;
  }
  if (!YT_HOSTS.has(host)) return null;
  const v = url.searchParams.get("v");
  if (v) return ID.test(v) ? v : null;
  const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
  return m ? m[1] : null;
}

export function classifyInput(line) {
  const input = String(line ?? "").trim();
  const videoId = videoIdOf(input);
  if (videoId) return { kind: "video", videoId, url: canonicalVideoUrl(videoId) };
  const url = toUrl(input);
  if (url && YT_HOSTS.has(hostOf(url))) {
    const list = url.searchParams.get("list");
    if (url.pathname === "/playlist" && list) {
      return { kind: "playlist", url: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` };
    }
    const channel = url.pathname.match(/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/);
    if (channel) return { kind: "channel", url: `https://www.youtube.com/${channel[1]}/videos` };
  }
  return { kind: "invalid", input };
}

export function parseInput(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || seen.has(line)) continue;
    seen.add(line);
    out.push(classifyInput(line));
  }
  return out;
}
