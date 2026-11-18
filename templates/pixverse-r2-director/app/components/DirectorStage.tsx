"use client";

import { StopIcon } from "@/app/components/icons";
import { SaveMenu } from "@/app/components/SavedClips";
import { SceneReel } from "@/app/components/SceneReel";
import { StageFrame } from "@/app/components/StageFrame";
import { Pill, Shimmer, Spinner } from "@/app/components/ui";
import { useDirector } from "@/app/lib/session";
import { stageStatus } from "@/app/lib/status";
import { SHOW_ELAPSED_AFTER_S, useElapsed } from "@/app/lib/useElapsed";
import { PixverseR2DirectorMainVideoView } from "@reactor-models/pixverse-r2-director";

const SAVE_OPTIONS = [
  { label: "Last 10 seconds", what: 10 },
  { label: "Last 30 seconds", what: 30 },
  { label: "Everything so far", what: "session" as const },
];

export function DirectorStage() {
  const { status, snapshot, scenes, setup, settingUp, busy, hasPlayed, buffering, stop } = useDirector();
  // Until a shot of the film has played, the stage shows the Reactor mark
  // and where the session is; then it shows the model's video.
  const previewing = settingUp && busy === null;
  const showVideo = hasPlayed && !previewing;
  const aspect = previewing ? setup.aspectRatio : (snapshot?.aspect_ratio ?? setup.aspectRatio);
  const state = previewing ? null : stageStatus(snapshot, scenes, busy, hasPlayed, buffering);
  const waited = useElapsed(state?.working ? state.label : null);
  const playing = showVideo ? scenes.find((clip) => clip.clip_id === snapshot?.playing_clip_id) : undefined;

  return (
    <StageFrame aspect={aspect} below={<SceneReel />}>
      {status === "ready" && (
        <PixverseR2DirectorMainVideoView
          videoObjectFit="cover"
          className={`absolute inset-0 h-full w-full ${showVideo ? "" : "invisible"}`}
        />
      )}

      {previewing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/reactor-wordmark-white.svg" alt="Reactor" className="w-28 opacity-80" />
          <span className="text-sm text-zinc-400">Click Generate to get started</span>
        </div>
      )}

      {/* Before the first shot plays, the status is the whole message. */}
      {state && !showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className={`text-lg font-medium ${state.tone === "error" ? "text-red-300" : "text-white"}`}>
            {state.label}
          </span>
          {state.working && <Shimmer />}
          {state.working && waited >= SHOW_ELAPSED_AFTER_S && (
            <span className="font-mono text-xs text-zinc-300">{waited}s</span>
          )}
        </div>
      )}
      {state && showVideo && (
        <div className="absolute left-3 top-3">
          <Pill tone={state.tone === "error" ? "error" : "neutral"}>
            {state.working && <Spinner className="size-3" />}
            {state.label}
          </Pill>
        </div>
      )}

      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-4 pt-12">
          <p className="max-w-[70%] text-sm leading-snug text-zinc-200">{playing.prompt}</p>
        </div>
      )}

      {showVideo && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {snapshot?.playing_clip_id && (
            <button
              type="button"
              onClick={() => void stop()}
              className="flex size-8 items-center justify-center rounded-full bg-black/60 text-zinc-100 backdrop-blur-md hover:bg-black/80"
              aria-label="Stop this shot"
            >
              <StopIcon className="size-3.5" />
            </button>
          )}
          <SaveMenu options={SAVE_OPTIONS} />
        </div>
      )}
    </StageFrame>
  );
}
