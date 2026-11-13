"use client";
import { HappyOysterActingMainVideoView } from "@reactor-models/happy-oyster-acting/react";
import { useActingSession } from "./ActingSession";

export function Stage() {
  const { status, sessionState } = useActingSession();
  const connected = status === "ready";
  const active =
    connected && ["live", "paused"].includes(sessionState?.phase ?? "");
  return (
    <section
      aria-label="Acting video"
      className={`relative order-1 aspect-video w-full overflow-hidden rounded-xl border lg:order-2 lg:aspect-auto lg:min-h-0 lg:min-w-0 lg:flex-1 ${active ? "border-white/[0.08] bg-black" : "border-white/10 bg-white/[0.03]"}`}
    >
      {connected && (
        <HappyOysterActingMainVideoView
          audioTrack="main_audio"
          videoObjectFit="contain"
          muted={false}
          className={`absolute inset-0 h-full w-full object-contain ${active ? "" : "invisible"}`}
        />
      )}
    </section>
  );
}
