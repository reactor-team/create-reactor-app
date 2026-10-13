"use client";

import type { ReactNode } from "react";

export type StageSnapshot = {
  width: number;
  height: number;
  generation_queued: number;
  playout_queued: number;
  playing: boolean;
  autoplay: boolean;
  valid_commands: string[];
};

type Props = {
  status: "disconnected" | "connecting" | "waiting" | "ready";
  snapshot: StageSnapshot | null;
  video: ReactNode;
  phase: string;
  lastError: string | null;
  onPlay: () => Promise<void>;
  onStop: () => Promise<void>;
  onReset: () => Promise<void>;
  onDisconnect: () => Promise<void>;
};

export function Stage({ status, snapshot, video, phase, lastError, onPlay, onStop, onReset, onDisconnect }: Props) {
  const ratio = snapshot ? `${snapshot.width} / ${snapshot.height}` : "16 / 9";
  const building = (snapshot?.generation_queued ?? 0) > 0;
  const playing = snapshot?.playing ?? false;
  const overlay = playing
    ? null
    : status === "connecting" || status === "waiting" || phase === "Connecting"
      ? "Starting a session…"
      : phase === "Uploading references"
        ? "Uploading references…"
        : building || phase === "Generating your clip"
          ? "Generating. Your clip will play on its own."
          : "Your clip plays here.";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black" style={{ aspectRatio: ratio }}>
        {video}
        {overlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/75 px-3.5 py-1.5">
              {(building || status === "connecting" || status === "waiting") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />}
              <span className="text-xs text-zinc-300">{overlay}</span>
            </div>
          </div>
        )}
        {playing && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-active" />
            <span className="font-mono text-[10px] text-zinc-300">ON AIR</span>
          </div>
        )}
      </div>

      {status === "ready" && snapshot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-zinc-400">{snapshot.generation_queued} building · {snapshot.playout_queued} ready</span>
            {snapshot.autoplay && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">autoplay on</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {playing ? (
              <button type="button" onClick={() => void onStop()} className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100">{snapshot.autoplay ? "Skip" : "Stop"}</button>
            ) : (
              <button type="button" onClick={() => void onPlay()} disabled={!snapshot.valid_commands.includes("play")} className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-30">Play next</button>
            )}
            <button type="button" onClick={() => void onReset()} className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300">Reset</button>
            <button type="button" onClick={() => void onDisconnect()} className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300">End</button>
          </div>
        </div>
      )}

      {lastError && <p className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-300" role="alert">{lastError}</p>}
    </div>
  );
}
