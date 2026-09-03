"use client";

import { useState } from "react";
import {
  ClipDownloadButton,
  ClipPlayer,
  RecordingError,
  useReactor,
  type Clip,
} from "@reactor-team/js-sdk";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./ui";

// Model-agnostic "Snap clip" panel.
//
// Captures the last `durationSeconds` of the live travel and pops a modal
// with the SDK's built-in <ClipPlayer> preview and a download button. It
// does not depend on the typed model package at all, only on
// @reactor-team/js-sdk.
//
// Recording is a base-SDK feature: it works the same way for every model
// with recording enabled, and the typed model packages
// (@reactor-models/happy-oyster, …) do not re-export the recording
// surface. So this is the one place in the example apps where importing
// directly from @reactor-team/js-sdk is idiomatic, not a smell.
//
// `<ClipPlayer>` and `<ClipDownloadButton>` auto-inherit the JWT resolver
// from `<HappyOysterProvider>` via React context, so no `getJwt` prop is
// needed here. The one case where you would still pass it explicitly is
// when the clip UI renders through a portal outside the provider subtree
// (e.g. a toast living in `app/layout.tsx`) — capture the resolver with
// `reactor.getJwtResolver()` at action time and thread it down.
//
// The panel gates itself on `status`, so it can sit in the rail
// unconditionally: it appears once a travel is streaming and disappears
// when the session ends. Clip URLs are short-lived (a few minutes) — the
// downloaded MP4 is the artifact, not the URL.
export interface SnapClipProps {
  /** Length of the snap, in seconds. Default 10. */
  durationSeconds?: number;
}

export function SnapClip({ durationSeconds = 10 }: SnapClipProps) {
  const { status, requestClip } = useReactor((s) => ({
    status: s.status,
    requestClip: s.requestClip,
  }));

  const [clip, setClip] = useState<Clip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "ready") return null;

  async function snap() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setClip(await requestClip(durationSeconds));
    } catch (cause) {
      setError(
        cause instanceof RecordingError
          ? `${cause.code}: ${cause.reason}`
          : cause instanceof Error
            ? cause.message
            : String(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <SectionLabel>Capture</SectionLabel>
      <Button onClick={snap} disabled={busy}>
        {busy ? "Capturing…" : `Snap last ${durationSeconds}s`}
      </Button>
      {error && (
        <p className="break-words text-xs leading-relaxed text-red-300/90">
          {error}
        </p>
      )}
      {clip && (
        <ClipModal
          clip={clip}
          onClose={() => setClip(null)}
          onError={(cause) => setError(cause.message)}
          onDownloaded={() => setError(null)}
        />
      )}
    </div>
  );
}

function ClipModal({
  clip,
  onClose,
  onError,
  onDownloaded,
}: {
  clip: Clip;
  onClose: () => void;
  onError: (error: Error) => void;
  onDownloaded: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950 p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Clip · {clip.kind}</SectionLabel>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <ClipPlayer
          clip={clip}
          onError={onError}
          className="w-full overflow-hidden rounded-md border border-white/[0.06]"
        />

        <div className="flex justify-end">
          <ClipDownloadButton
            clip={clip}
            filename={`happy-oyster-clip-${Math.floor(Date.now() / 1000)}.mp4`}
            onSuccess={onDownloaded}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
