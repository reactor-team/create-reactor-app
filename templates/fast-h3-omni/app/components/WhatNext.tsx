"use client";

import { useState } from "react";

export function WhatNext({ busy, onContinue }: { busy: boolean; onContinue: (action: string) => Promise<void> }) {
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
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">When playback ends, this session waits for your next beat. The references carry over, and the next clip continues the previous clip’s motion, camera, and sound.</p>
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
