"use client";
import { ReactorView } from "@reactor-team/js-sdk";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { useEdenLiveTrack, type StateUpdate } from "../lib/model";

// The generated world fills the stage and the draft it comes from sits in the
// corner. With a built-in game the draft is the `draft_video` track; with your
// own game it is the local scene, which is also what the model receives.
export function Stage({
  ready,
  snapshot,
  playable,
  mouseLook,
  hint,
  draft,
  surfaceProps,
}: {
  ready: boolean;
  snapshot: StateUpdate | null;
  playable: boolean;
  mouseLook: boolean;
  hint: string;
  draft?: ReactNode;
  surfaceProps: HTMLAttributes<HTMLDivElement> & {
    ref: Ref<HTMLDivElement>;
  };
}) {
  const hasWorld = Boolean(useEdenLiveTrack("main_video"));
  const hasDraft = Boolean(useEdenLiveTrack("draft_video"));
  const [result, ...detail] = snapshot?.outcome ?? [];
  const staged = Boolean(snapshot?.game || snapshot?.image_name);
  const message = !ready
    ? "Connect to begin"
    : !staged
      ? draft
        ? "Preparing your world"
        : "Choose a game"
      : !hasWorld
        ? "Waiting for video"
        : "";
  const badge = !snapshot?.started
    ? staged
      ? "PREVIEW"
      : ""
    : snapshot.ended
      ? "ENDED"
      : snapshot.paused
        ? "PAUSED"
        : "LIVE";
  const lost = Boolean(snapshot?.ended && snapshot.game_state === "LOST");
  return (
    <div
      {...surfaceProps}
      className={`stage ${playable ? "playable" : ""} ${mouseLook ? "locked" : ""} ${lost ? "lost" : ""}`}
      aria-label="Generated world"
    >
      {ready && (
        <ReactorView
          track="main_video"
          muted
          videoObjectFit="contain"
          className="stage-video"
        />
      )}
      {lost && <div className="lost-tint" aria-hidden="true" />}
      {draft ? (
        <div className="draft">
          {draft}
          <span>Your game</span>
        </div>
      ) : (
        ready && (
          <div className="draft" hidden={!hasDraft}>
            <ReactorView
              track="draft_video"
              muted
              videoObjectFit="contain"
              className="stage-video"
            />
            <span>Draft</span>
          </div>
        )
      )}
      {badge && (
        <span className={`badge ${badge.toLowerCase()}`}>
          <i />
          {badge}
        </span>
      )}
      {snapshot?.started &&
        !snapshot.ended &&
        snapshot.health != null &&
        snapshot.health_max ? (
        <HealthHud health={snapshot.health} max={snapshot.health_max} />
      ) : null}
      {message && <p className="stage-message">{message}</p>}
      {hint && <span className="look-hint">{hint}</span>}
      {result && snapshot?.ended && (
        <div className="outcome" role="status">
          <span className="eyebrow">
            {snapshot.game_state === "WON" ? "YOU WON" : "GAME OVER"}
          </span>
          <strong>{result}</strong>
          {detail.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// The player's health from `state_update`, in the games that have it.
function HealthHud({ health, max }: { health: number; max: number }) {
  const share = Math.max(0, Math.min(1, health / max));
  return (
    <div
      className="hud"
      role="status"
      aria-label={`Health ${Math.round(health)} of ${Math.round(max)}`}
    >
      <span>Health</span>
      <span className="hud-bar">
        <i
          style={{ width: `${share * 100}%` }}
          className={share < 0.3 ? "low" : ""}
        />
      </span>
      <span>{Math.round(health)}</span>
    </div>
  );
}
