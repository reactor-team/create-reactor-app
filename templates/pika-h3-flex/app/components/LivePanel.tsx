"use client";

import { useState } from "react";

type Props = {
  /** "anthropic · claude-haiku-5-5": which LLM writes, never its key. */
  writer: string;
  live: boolean;
  writing: boolean;
  /** Two clips already wait ahead of playback. */
  waiting: boolean;
  clips: number;
  limit: number;
  failure: string | null;
  direction: string;
  disabled: boolean;
  onStart: () => void;
  onPause: () => void;
  onSteer: (direction: string) => void;
};

// Live mode: an LLM keeps writing the next clip, and the box steers it.
export function LivePanel({ writer, live, writing, waiting, clips, limit, failure, direction, disabled, onStart, onPause, onSteer }: Props) {
  const [text, setText] = useState("");
  const status = !live
    ? "Off. Go live and the director writes each next clip from the scene so far."
    : writing
      ? "Writing the next clip…"
      : waiting
        ? "Two clips are ready ahead of playback; writing the next when one plays."
        : "Queueing the next clip…";

  function send() {
    if (!text.trim() || text.trim() === direction) return;
    onSteer(text);
    setText("");
  }

  return (
    <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "animate-pulse bg-active" : "bg-zinc-600"}`} />
          <span className="text-xs font-medium text-zinc-200">Live director</span>
          <span className="truncate font-mono text-[10px] text-zinc-500">{writer}</span>
        </div>
        {live
          ? <button type="button" onClick={onPause} className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100">Pause</button>
          : <button type="button" onClick={onStart} disabled={disabled} className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-40">Go live</button>}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">{status}{live && ` ${clips}/${limit} clips written.`}</p>
      {failure && <p className="mt-2 text-xs text-amber-300" role="status">{failure}</p>}
      {live && (
        <>
          <div className="mt-3 flex gap-2">
            <input aria-label="Direction for the next clip" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") send(); }} placeholder="Steer it: “the storm breaks”, “cut to the rooftop”…" className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
            <button type="button" onClick={send} disabled={!text.trim() || text.trim() === direction} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-40">Send to the next clip</button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">{direction ? <>Direction: <span className="text-zinc-300">{direction}</span>. </> : null}A new direction replaces the clip being written, not the ones already queued, so it reaches the screen about one clip later.</p>
        </>
      )}
    </div>
  );
}
