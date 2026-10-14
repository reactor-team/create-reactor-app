"use client";

import { useState } from "react";
import {
  H3MainVideoView,
  useH3,
  useH3StateUpdate,
  type H3State,
} from "../lib/model";
import { useCommand } from "../lib/command";
import { useSession } from "../lib/session";
import { WhatNext } from "./WhatNext";

// The output, and everything about it that matters, in one place.
//
// The old version buried playback in a sidebar panel below the composer,
// which meant queueing a clip appeared to do nothing. Autoplay is on from the
// moment the session connects, so a queued clip starts by itself; this
// component's job is to say which of the four states you are in while that
// happens, on top of the picture rather than somewhere off to the side.
export function Stage() {
  const { status } = useH3();
  const { busy, phase, hasQueued, lastAccepted } = useSession();
  const [state, setState] = useState<H3State | null>(null);
  useH3StateUpdate(setState);
  if (status !== "ready" && state) setState(null);

  const ratio = state ? `${state.width} / ${state.height}` : "16 / 9";
  const building = (state?.generation_queued ?? 0) > 0;
  const playing = state?.playing ?? false;

  const overlay = !playing
    ? status === "connecting" || status === "waiting" || phase === "connecting"
      ? "Starting a session…"
      : phase === "uploading"
        ? "Uploading references…"
        : building
          ? "Generating. It will start playing on its own."
          : hasQueued
            ? null
            : "Your clip plays here."
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black"
        style={{ aspectRatio: ratio }}
      >
        <H3MainVideoView audioTrack="main_audio" className="h-full w-full" />

        {overlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5">
              {(building || busy) && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              )}
              <span className="text-xs text-zinc-300">{overlay}</span>
            </div>
          </div>
        )}

        {playing && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-active" />
            <span className="font-mono text-[10px] text-zinc-300">ON AIR</span>
          </div>
        )}
      </div>

      <Transport state={state} />

      {lastAccepted && (
        <p className="font-mono text-[10px] text-zinc-600">
          last queued {lastAccepted.clipId.slice(0, 8)} ·{" "}
          {lastAccepted.seconds.toFixed(2)}s · seed {lastAccepted.seed}
        </p>
      )}

      <WhatNext />
    </div>
  );
}

function Transport({ state }: { state: H3State | null }) {
  const { status, play, stop, reset, disconnect } = useH3();
  const { run } = useCommand();

  if (status !== "ready" || !state) return null;

  const canPlay = state.valid_commands.includes("play");

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-zinc-400">
          {state.generation_queued} building · {state.playout_queued} ready
        </span>
        {state.autoplay && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            autoplay on
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {state.playing ? (
          <button
            onClick={() => void run("stop", stop, { expectsReply: false })}
            title={
              state.autoplay
                ? "Skip to the next ready clip"
                : "Cut playback; the queues are untouched"
            }
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100"
          >
            {state.autoplay ? "Skip" : "Stop"}
          </button>
        ) : (
          <button
            onClick={() =>
              void run("play", () => play({}), { expectsReply: false })
            }
            disabled={!canPlay}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-30"
          >
            Play next
          </button>
        )}
        <button
          onClick={() => void run("reset", reset)}
          title="Drop both queues, cut playback, restore defaults"
          className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          Reset
        </button>
        <button
          onClick={() => void disconnect()}
          title="End the session"
          className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          End
        </button>
      </div>
    </div>
  );
}
