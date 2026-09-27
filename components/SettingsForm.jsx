"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { saveSettingsAction } from "@/app/actions/settings";

export default function SettingsForm({ models, settings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={formAction} className="card rows">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <label htmlFor="deepseekModel" className="text-[14px]">DeepSeek model</label>
          <p className="subhead">Writes the sheets and names new themes.</p>
        </div>
        <select id="deepseekModel" name="deepseekModel" defaultValue={settings.deepseekModel} className="field">
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <label htmlFor="thresholdPercent" className="text-[14px]">Auto-sort threshold</label>
          <p className="subhead">Jev files a video by itself when it is at least this sure; below, it waits in To review.</p>
        </div>
        <span className="flex items-center gap-2">
          <input
            id="thresholdPercent"
            type="number"
            name="thresholdPercent"
            min={0}
            max={100}
            step={1}
            defaultValue={Math.round(settings.jevThresholdPermille / 10)}
            className="field w-20 text-right tabular-nums"
          />
          <span className="text-[14px]">%</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span aria-live="polite">
          {state?.ok && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-positive">
              <Check size={15} aria-hidden="true" />
              Saved
            </span>
          )}
          {state && !state.ok && <span className="text-[13px] text-negative">{state.error}</span>}
        </span>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
