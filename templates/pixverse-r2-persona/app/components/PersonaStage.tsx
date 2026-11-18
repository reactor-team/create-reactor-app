"use client";

import { MicIcon, MicOffIcon, MutedIcon, PhoneIcon, VolumeIcon } from "@/app/components/icons";
import { SaveMenu } from "@/app/components/SavedClips";
import { StageFrame } from "@/app/components/StageFrame";
import { cn, Pill, Shimmer } from "@/app/components/ui";
import { answerText, inCall, usePersona, type Busy, type Snapshot } from "@/app/lib/session";
import { SHOW_ELAPSED_AFTER_S, useElapsed } from "@/app/lib/useElapsed";
import { PixverseR2PersonaMainVideoView } from "@reactor-models/pixverse-r2-persona";

const SAVE_OPTIONS = [
  { label: "Last 15 seconds", what: 15 },
  { label: "Last minute", what: 60 },
  { label: "The whole call", what: "session" as const },
];

const END_REASONS: Record<string, string> = {
  ended_by_client: "Call ended",
  idle: "The call ended after five quiet minutes",
  max_duration: "The call reached its 30 minute limit",
};

function callStatus(snapshot: Snapshot | null, busy: Busy, name: string): { label: string; working: boolean } | null {
  if (busy === "connecting") return { label: "Connecting…", working: true };
  if (busy === "uploading") return { label: "Sending the portrait…", working: true };
  if (busy === "creating" || snapshot?.phase === "creating_character") return { label: `Creating ${name}…`, working: true };
  switch (snapshot?.phase) {
    case "starting":
      return {
        label: snapshot.wait_position
          ? `Waiting for a free line · ${snapshot.wait_position} in line`
          : `Calling ${name}…`,
        working: true,
      };
    case "connecting":
      return { label: `${name} is joining…`, working: true };
    case "ending":
      return { label: "Hanging up…", working: true };
    case "ended":
      return { label: END_REASONS[snapshot.end_reason ?? ""] ?? "Call ended", working: false };
    case "failed":
      return { label: snapshot.last_error?.reason ?? "The call did not go through", working: false };
    default:
      return busy === "starting" ? { label: `Calling ${name}…`, working: true } : null;
  }
}

const SUBTITLE_CHARS = 140;

/** The end of `text`, at most `limit` characters, starting on a word. */
function tail(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(-limit);
  return `…${cut.slice(cut.indexOf(" ") + 1)}`;
}

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function PersonaStage() {
  const { status, snapshot, setup, busy, log, mic, muted, toggleMic, toggleMuted, hangUp } = usePersona();
  const name = setup.name.trim() || "The character";
  const aspect = snapshot?.aspect_ratio ?? setup.aspectRatio;
  const live = snapshot?.phase === "live";
  const calling = inCall(snapshot?.phase);
  const state = live ? null : callStatus(snapshot, busy, name);
  const waited = useElapsed(state?.working ? state.label : null);

  const lastAnswer = [...log].reverse().find((entry) => entry.who === "character");
  const subtitle = lastAnswer?.who === "character" ? tail(answerText(lastAnswer.sentences), SUBTITLE_CHARS) : "";

  return (
    <StageFrame aspect={aspect}>
      {status === "ready" && (
        <PixverseR2PersonaMainVideoView
          audioTrack="main_audio"
          muted={muted}
          videoObjectFit="cover"
          className={cn("absolute inset-0 h-full w-full", !live && "invisible")}
        />
      )}

      {!live && !state && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/reactor-wordmark-white.svg" alt="Reactor" className="w-28 opacity-80" />
          <span className="text-sm text-zinc-400">Click Call to get started</span>
        </div>
      )}

      {state && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-lg font-medium text-white">{state.label}</span>
          {state.working && <Shimmer />}
          {state.working && waited >= SHOW_ELAPSED_AFTER_S && (
            <span className="font-mono text-xs text-zinc-300">{clock(waited)}</span>
          )}
        </div>
      )}

      {live && (
        <div className="absolute left-3 top-3">
          <Pill tone="live">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            Live · {clock(snapshot.call_elapsed_seconds)}
          </Pill>
        </div>
      )}

      {live && subtitle && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-6">
          <p className="max-w-[90%] rounded-lg bg-black/65 px-3 py-2 text-center text-sm leading-snug text-white backdrop-blur-sm">
            {subtitle}
          </p>
        </div>
      )}

      {calling && (
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
          <RoundButton onClick={toggleMic} disabled={mic === "off" || mic === "blocked"} label={mic === "muted" ? "Unmute microphone" : "Mute microphone"} active={mic === "muted"}>
            {mic === "on" ? <MicIcon /> : <MicOffIcon />}
          </RoundButton>
          <button
            type="button"
            onClick={() => void hangUp()}
            disabled={busy === "ending"}
            className="flex size-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-400"
            aria-label="End call"
          >
            <PhoneIcon className="size-5 rotate-[135deg]" />
          </button>
          <RoundButton onClick={toggleMuted} label={muted ? "Unmute speaker" : "Mute speaker"} active={muted}>
            {muted ? <MutedIcon /> : <VolumeIcon />}
          </RoundButton>
        </div>
      )}

      {live && (
        <div className="absolute right-3 top-3">
          <SaveMenu options={SAVE_OPTIONS} />
        </div>
      )}
    </StageFrame>
  );
}

function RoundButton({
  children,
  onClick,
  label,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full backdrop-blur-md transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        active ? "bg-white text-zinc-900" : "bg-black/60 text-white hover:bg-black/80",
      )}
    >
      {children}
    </button>
  );
}
