// The three steps of a video. Each one moves Video.state, stores what it made, queues the next.
import { enqueue } from "../jobs.mjs";
import { indexVideo } from "../search.mjs";
import { iso } from "../time.mjs";
import { parseVtt, transcriptText } from "../youtube/vtt.mjs";
import { trackCandidates } from "../youtube/ytdlp.mjs";
import { applyClassification } from "./classify.mjs";

export function createSteps({ db, youtube, summarize, classify, now = Date.now }) {
  const videoOf = (id) => db.prepare("SELECT * FROM Video WHERE id = ?").get(id);
  const setState = (id, state, error = null) =>
    db.prepare("UPDATE Video SET state = ?, error = ?, updatedAt = ? WHERE id = ?").run(state, error, iso(now()), id);

  async function fetchStep(video) {
    setState(video.id, "fetching");
    const meta = await youtube.fetchMetadata(video.id);
    db.prepare(`UPDATE Video SET title = ?, channel = ?, channelId = ?, durationS = ?, publishedAt = ?, chapters = ?, updatedAt = ? WHERE id = ?`)
      .run(meta.title, meta.channel, meta.channelId, meta.durationS, meta.publishedAt, JSON.stringify(meta.chapters), iso(now()), video.id);
    let chosen = null;
    let segments = [];
    let rateLimit = null;
    for (const track of trackCandidates(meta)) {
      let vtt;
      try {
        vtt = await youtube.downloadSubtitle(video.id, track);
      } catch (err) {
        if (err?.rateLimited) { rateLimit = err; continue; } // 429 is per language: try the next track
        throw err;
      }
      segments = parseVtt(vtt ?? "");
      if (segments.length) { chosen = track; break; }
    }
    if (!chosen) {
      if (rateLimit) throw rateLimit;
      setState(video.id, "no_transcript", "YouTube has no subtitles for this video.");
      indexVideo(db, video.id); // its title stays searchable
      return;
    }
    const text = transcriptText(segments);
    const language = chosen.lang.split("-")[0];
    db.transaction(() => {
      db.prepare(`INSERT INTO Transcript (videoId, language, kind, text, chars) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(videoId) DO UPDATE SET language = excluded.language, kind = excluded.kind, text = excluded.text, chars = excluded.chars`)
        .run(video.id, language, chosen.kind, text, text.length);
      db.prepare("UPDATE Video SET language = ? WHERE id = ?").run(language, video.id);
      enqueue(db, { videoId: video.id, step: "summarize", now: now() });
    })();
    indexVideo(db, video.id);
    setState(video.id, "summarizing");
  }

  async function summarizeStep(video) {
    setState(video.id, "summarizing");
    const transcript = db.prepare("SELECT text FROM Transcript WHERE videoId = ?").get(video.id);
    if (!transcript) throw new Error("No transcript to summarize — retry the video.");
    const { markdown, model } = await summarize(videoOf(video.id), transcript.text);
    db.transaction(() => {
      const regenerated = Boolean(db.prepare("SELECT 1 FROM Summary WHERE videoId = ?").get(video.id));
      db.prepare(`INSERT INTO Summary (videoId, markdown, model, createdAt) VALUES (?, ?, ?, ?)
                  ON CONFLICT(videoId) DO UPDATE SET markdown = excluded.markdown, model = excluded.model, createdAt = excluded.createdAt`)
        .run(video.id, markdown, model, iso(now()));
      // A new sheet for a filed video makes its theme's consolidated sheet stale.
      const { themeId } = videoOf(video.id);
      if (regenerated && themeId) db.prepare("UPDATE Theme SET changesSinceSheet = changesSinceSheet + 1 WHERE id = ?").run(themeId);
    })();
    indexVideo(db, video.id);
    if (videoOf(video.id).themeSource == null) {
      enqueue(db, { videoId: video.id, step: "classify", now: now() });
      setState(video.id, "classifying");
    } else {
      setState(video.id, "done");
    }
  }

  // Robin's choice wins: a video filed by hand is never re-sorted — neither on a Retry nor when he
  // moved it while Jev and DeepSeek were still working on it.
  const filedByHand = (id) => videoOf(id).themeSource === "manual";

  async function classifyStep(video) {
    if (filedByHand(video.id)) { setState(video.id, "done"); return; }
    setState(video.id, "classifying");
    const summary = db.prepare("SELECT markdown FROM Summary WHERE videoId = ?").get(video.id);
    if (!summary) throw new Error("No summary to classify — regenerate the summary.");
    const result = await classify(videoOf(video.id), summary.markdown);
    if (filedByHand(video.id)) { setState(video.id, "done"); return; }
    applyClassification(db, video.id, result, now());
    setState(video.id, "done");
  }

  const STEPS = { fetch: fetchStep, summarize: summarizeStep, classify: classifyStep };

  return {
    async run(job) {
      const video = videoOf(job.videoId);
      if (!video) return; // deleted meanwhile
      await STEPS[job.step](video);
    },
  };
}
