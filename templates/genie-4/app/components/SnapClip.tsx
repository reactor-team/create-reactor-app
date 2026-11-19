"use client";
import { Button, Panel } from "./ui";
import { useState } from "react";
import {
  ClipDownloadButton,
  ClipPlayer,
  RecordingError,
  useReactor,
  type Clip,
} from "@reactor-team/js-sdk";

// Model-independent recording UI. A completed clip stays mounted after disconnect.
export function SnapClip({ getJwt }: { getJwt: () => Promise<string> }) {
  const status = useReactor((state) => state.status);
  const requestClip = useReactor((state) => state.requestClip);
  const [clip, setClip] = useState<Clip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function snap() {
    setBusy(true);
    setError(null);
    try {
      setClip(await requestClip(10));
    } catch (cause) {
      setError(
        cause instanceof RecordingError
          ? `${cause.code}: ${cause.reason}`
          : cause instanceof Error
            ? cause.message
            : "Capture failed."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {status === "ready" && (
        <Panel variant="section" className="space-y-3">
          <p className="eyebrow">Capture</p>
          <p className="text-xs text-zinc-500">
            Capture the last 10 seconds when session recording is available.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => void snap()}
          >
            {busy ? "Capturing…" : "Snap a clip"}
          </Button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Panel>
      )}
      {clip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Captured clip"
          onKeyDown={(event) => {
            if (event.key === "Escape") setClip(null);
          }}
        >
          <div className="panel w-full max-w-3xl space-y-4">
            <div className="flex justify-between">
              <h2>Captured clip</h2>
              <Button
                variant="secondary"
                size="sm"
                autoFocus
                onClick={() => setClip(null)}
              >
                Close
              </Button>
            </div>
            <ClipPlayer
              clip={clip}
              getJwt={getJwt}
              className="w-full"
              onError={(cause) => setError(cause.message)}
            />
            <ClipDownloadButton
              clip={clip}
              getJwt={getJwt}
              filename="genie-4-world.mp4"
              onError={(cause) => setError(cause.message)}
              onSuccess={() => setError(null)}
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Download now: clip links expire after a few minutes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
