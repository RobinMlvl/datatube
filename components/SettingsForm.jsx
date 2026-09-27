"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions/settings";

export default function SettingsForm({ models, settings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={formAction} className="space-y-4 text-sm">
      <label className="block">
        <span className="font-medium">DeepSeek model</span>
        <span className="block text-neutral-500">Writes the sheets and names new themes.</span>
        <select name="deepseekModel" defaultValue={settings.deepseekModel} className="mt-1 rounded-md border border-neutral-300 px-2 py-1.5">
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">Auto-sort threshold</span>
        <span className="block text-neutral-500">Jev files a video by itself when it is at least this sure; below, the video waits in To review.</span>
        <span className="mt-1 flex items-center gap-2">
          <input type="number" name="thresholdPercent" min={0} max={100} step={1} defaultValue={Math.round(settings.jevThresholdPermille / 10)} className="w-24 rounded-md border border-neutral-300 px-2 py-1.5" />
          <span>%</span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {state?.ok && <span className="text-neutral-600">Saved.</span>}
        {state && !state.ok && <span className="text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
