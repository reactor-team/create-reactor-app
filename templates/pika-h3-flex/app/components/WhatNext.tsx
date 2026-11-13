"use client";

import { useState } from "react";
import type { ContinueMode } from "../lib/scene";

const MODES: [ContinueMode, string, string][] = [
  ["frame", "Frame", "Opens on the last frame only: no references, and the sound starts afresh. Queue beats while the previous clip builds."],
  ["latent", "Latent", "The last 2.33 s of picture and sound carry over, and your references stay. Wait for the previous clip to build."],
];

/** How "Continue this scene" continues the previous clip. */
export function ContinueModePicker({ mode, disabled, onChange }: { mode: ContinueMode; disabled: boolean; onChange: (mode: ContinueMode) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <span className="text-xs text-zinc-300">Continue from the previous clip by</span>
      <div className="flex rounded-md border border-zinc-800 p-0.5" role="radiogroup" aria-label="Continue mode">
        {MODES.map(([value, label, hint]) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} title={hint} disabled={disabled} onClick={() => onChange(value)} className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${mode === value ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
            {label}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-zinc-500">{MODES.find(([value]) => value === mode)?.[2]}</span>
    </div>
  );
}

export function WhatNext({ busy, mode, onContinue }: { busy: boolean; mode: ContinueMode; onContinue: (action: string) => Promise<void> }) {
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function queueNext() {
    if (!action.trim()) return;
    setError(null);
    try {
      await onContinue(action.trim());
      setAction("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue the scene.");
    }
  }

  return (
    <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
      <label htmlFor="next-beat" className="text-xs font-medium text-zinc-200">Continue this scene</label>
      <div className="mt-2 flex gap-2">
        <input id="next-beat" value={action} onChange={event => setAction(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void queueNext(); }} disabled={busy} placeholder="Describe the next beat…" className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
        <button type="button" onClick={() => void queueNext()} disabled={busy || !action.trim()} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-40">Queue next</button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">When playback ends, this session holds the last frame and waits for your next beat. {mode === "latent"
        ? "The references carry over, and the next clip continues the previous clip’s motion, camera, and sound."
        : "The next clip opens on the previous clip’s last frame, without references; the scene is described in words. Queue the next beat while this one builds, and the clips play back to back."}</p>
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
