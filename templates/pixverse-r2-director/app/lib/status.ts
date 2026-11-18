import type { Busy, Clip, Snapshot } from "./session";

export interface StageStatus {
  label: string;
  /** Show a progress sweep: something is on its way. */
  working: boolean;
  tone: "neutral" | "error";
}

const BEFORE_WORLD: ReadonlyArray<Snapshot["phase"]> = ["idle", "world_ready", "ended", "failed"];

/** The one line the stage shows about where the session is. */
export function stageStatus(
  snapshot: Snapshot | null,
  scenes: Clip[],
  busy: Busy,
  hasPlayed: boolean,
  buffering: { ready: number; target: number } | null,
): StageStatus | null {
  if (busy === "connecting") return { label: "Connecting…", working: true, tone: "neutral" };
  if (busy === "creating" && (!snapshot || BEFORE_WORLD.includes(snapshot.phase)))
    return { label: "Setting up the film…", working: true, tone: "neutral" };
  if (!snapshot) return null;

  if (snapshot.phase === "creating_world") return { label: "Setting up the film…", working: true, tone: "neutral" };
  if (snapshot.playing_clip_id) {
    const number = sceneNumber(scenes, snapshot.playing_clip_id);
    return { label: number ? `Shot ${number}` : "Playing", working: false, tone: "neutral" };
  }
  if (snapshot.phase === "starting") {
    return {
      label: snapshot.wait_position
        ? `Waiting for a free generator · ${snapshot.wait_position} in line`
        : "Generating the first shot…",
      working: true,
      tone: "neutral",
    };
  }
  if (buffering)
    return {
      label: `Buffering · ${Math.min(buffering.ready, buffering.target)} of ${buffering.target} s ready`,
      working: true,
      tone: "neutral",
    };
  if (snapshot.ready_clips > 0 && !snapshot.autoplay)
    return { label: "Shot ready. Press play.", working: false, tone: "neutral" };
  if (snapshot.pending_clips > 0)
    return {
      label: hasPlayed ? "Next shot is generating…" : "Generating the first shot…",
      working: true,
      tone: "neutral",
    };
  if (snapshot.phase === "failed" && snapshot.last_error)
    return { label: snapshot.last_error.reason, working: false, tone: "error" };
  if (snapshot.world_id)
    return { label: hasPlayed ? "Add a shot to keep going" : "Add a shot to begin", working: false, tone: "neutral" };
  return null;
}

/** A clip's position among the current film's shots, from 1. */
export function sceneNumber(scenes: Clip[], clipID: string): number | null {
  const index = scenes.findIndex((clip) => clip.clip_id === clipID);
  return index === -1 ? null : index + 1;
}
