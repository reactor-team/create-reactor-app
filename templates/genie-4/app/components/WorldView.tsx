"use client";
import { useEffect, useRef, useState } from "react";
import {
  Genie4MainVideoView,
  useGenie4,
  useGenie4Track,
} from "@reactor-models/genie-4";
import { FOCUS_RING } from "./ui";

export function WorldView() {
  const { status } = useGenie4();
  const audioTrack = useGenie4Track("main_audio");
  const audio = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    let cancelled = false;
    setBlocked(false);
    element.srcObject =
      status === "ready" && audioTrack ? new MediaStream([audioTrack]) : null;
    if (element.srcObject)
      void element.play().catch(() => {
        if (!cancelled) setBlocked(true);
      });
    return () => {
      cancelled = true;
      element.pause();
      element.srcObject = null;
    };
  }, [audioTrack, status]);

  function toggleSound() {
    const element = audio.current;
    if (!element) return;
    if (blocked) {
      setMuted(false);
      element.muted = false;
      void element
        .play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    } else {
      element.muted = !muted;
      setMuted(!muted);
      if (!element.muted) void element.play().catch(() => setBlocked(true));
    }
  }
  const label = blocked
    ? "Enable sound"
    : muted
      ? "Unmute sound"
      : "Mute sound";
  return (
    <section className="world-stage flex min-w-0 items-start justify-center p-4 lg:min-h-0 lg:flex-1 lg:p-0">
      <div className="world-frame relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <Genie4MainVideoView
          muted
          className="h-full w-full"
          videoObjectFit="contain"
        />
        <audio ref={audio} autoPlay muted={muted} aria-hidden="true" />
        <div data-world-ui className="absolute bottom-3 right-3">
          <button
            type="button"
            onClick={toggleSound}
            disabled={status !== "ready" || !audioTrack}
            aria-label={label}
            title={label}
            className={`inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-black/70 p-2 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40 ${FOCUS_RING}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m11 5-6 4H2v6h3l6 4V5Z" />
              {muted || blocked ? (
                <>
                  <path d="m17 9 5 6M22 9l-5 6" />
                </>
              ) : (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                </>
              )}
            </svg>
            {blocked && <span className="text-xs">Enable sound</span>}
          </button>
        </div>
      </div>
    </section>
  );
}
