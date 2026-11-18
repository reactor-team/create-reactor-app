"use client";

import { PlayIcon, XIcon } from "@/app/components/icons";
import { cn, FOCUS_RING, Spinner } from "@/app/components/ui";
import { useDirector, type Clip } from "@/app/lib/session";

/** The shots of the current run, in order, under the stage. They play by themselves. */
export function SceneReel() {
  const { scenes, settingUp, play, remove } = useDirector();
  const clips = settingUp ? [] : scenes.filter((clip) => clip.status !== "cancelled");

  return (
    <div className="scrollbar-thin flex h-[96px] shrink-0 gap-2 overflow-x-auto pb-1">
      {clips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zinc-800 text-xs text-zinc-600">
          Shots appear here and play in order.
        </div>
      ) : (
        clips.map((clip, index) => (
          <SceneCard
            key={clip.clip_id}
            clip={clip}
            number={index + 1}
            onPlay={() => void play(clip.clip_id)}
            onRemove={() => void remove(clip.clip_id)}
          />
        ))
      )}
    </div>
  );
}

const STATUS_TEXT: Record<Clip["status"], string> = {
  queued: "up next",
  generating: "generating",
  ready: "ready",
  playing: "playing",
  played: "played",
  stopped: "stopped",
  failed: "failed",
  cancelled: "removed",
};

function SceneCard({
  clip,
  number,
  onPlay,
  onRemove,
}: {
  clip: Clip;
  number: number;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const removable = clip.status === "queued" || clip.status === "ready";
  const playable = clip.status === "ready";
  return (
    <div
      className={cn(
        "group relative flex w-52 shrink-0 flex-col justify-between rounded-md border p-2.5 transition",
        clip.status === "playing" && "border-brand/70 bg-brand/5",
        clip.status === "failed" && "border-red-900/70 bg-red-950/20",
        clip.status !== "playing" && clip.status !== "failed" && "border-zinc-800 bg-zinc-900/40",
      )}
    >
      <p className="line-clamp-2 pr-4 text-xs leading-snug text-zinc-300" title={clip.prompt}>
        {clip.prompt}
      </p>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1.5 font-mono text-[11px]",
            clip.status === "playing" ? "text-brand" : clip.status === "failed" ? "text-red-400" : "text-zinc-500",
          )}
          title={clip.error_code ?? undefined}
        >
          <span className="text-zinc-600">{number}</span>
          {clip.status === "generating" && <Spinner className="size-2.5 border" />}
          {clip.status === "playing" && <Equalizer />}
          {STATUS_TEXT[clip.status]} · {clip.seconds}s
        </span>
        {playable && (
          <button
            type="button"
            onClick={onPlay}
            className={cn(
              "flex size-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition hover:bg-white",
              FOCUS_RING,
            )}
            aria-label="Play this shot"
          >
            <PlayIcon className="size-3" />
          </button>
        )}
      </div>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 text-zinc-600 opacity-0 transition hover:text-zinc-200 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Remove this shot"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Equalizer() {
  return (
    <span className="flex h-2.5 items-end gap-px">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="animate-eq h-full w-0.5 origin-bottom bg-current"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}
