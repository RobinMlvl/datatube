// The real wiring: yt-dlp, DeepSeek, Jev and the settings of the moment. Used by the worker and
// by the Server Actions that call a model (regenerate a theme sheet).
import { recordApiCall } from "../costs.mjs";
import { createDeepseek } from "../llm/deepseek.mjs";
import { createJev } from "../llm/jev.mjs";
import { readSettings } from "../settings.mjs";
import { downloadSubtitle, fetchMetadata, listEntries, runYtDlp } from "../youtube/ytdlp.mjs";
import { classifyVideo } from "./classify.mjs";
import { createSteps } from "./steps.mjs";
import { summarizeVideo } from "./summarize.mjs";

export function createLivePipeline(db, { now = Date.now } = {}) {
  const record = (call) => recordApiCall(db, { ...call, at: now() });
  const deepseek = createDeepseek({ record });
  const jev = createJev({ record });
  const youtube = {
    fetchMetadata: (id) => fetchMetadata(id, { run: runYtDlp }),
    downloadSubtitle: (id, track) => downloadSubtitle(id, track, { run: runYtDlp }),
    listEntries: (url) => listEntries(url, { run: runYtDlp }),
  };
  const steps = createSteps({
    db, youtube, now,
    summarize: async (video, transcript) => {
      const { deepseekModel } = readSettings(db);
      const markdown = await summarizeVideo({ video, transcript, model: deepseekModel, complete: (args) => deepseek({ ...args, videoId: video.id }) });
      return { markdown, model: deepseekModel };
    },
    classify: (video, summary) => {
      const { deepseekModel, jevThresholdPermille } = readSettings(db);
      return classifyVideo({
        db, video, summary, model: deepseekModel, thresholdPermille: jevThresholdPermille,
        jev: (args) => jev({ ...args, videoId: video.id }),
        complete: (args) => deepseek({ ...args, videoId: video.id }),
      });
    },
  });
  return { steps, deepseek, jev, youtube };
}
