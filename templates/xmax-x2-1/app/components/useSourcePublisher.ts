"use client";

import { useEffect, useRef, useState } from "react";
import { useXmaxX21 } from "@reactor-models/xmax-x2-1";
import type { DiagnosticReporter } from "@/app/lib/errors";

// The single owner of the `source` slot. Every input mode (webcam, video,
// image) only *produces* a MediaStreamTrack and hands it here; this hook is
// the only code that calls publish/unpublish on `source`, so mode switches
// can never race two publishers against the same transceiver.
//
// Reconciliation is serialized: one loop at a time compares the desired
// track (latest from the producer) with the published one and converges.
// Switching tracks does NOT unpublish first — the SDK's publishTrack sends
// the `publish_track` control request and then replaceTrack()s the new
// media onto the existing RTCRtpSender without renegotiating, so a direct
// re-publish is the safe path. Unpublish only happens when the producer
// goes away entirely (no track) or on unmount.
export function useSourcePublisher(
  track: MediaStreamTrack | null,
  onError: DiagnosticReporter
): boolean {
  const { publish, unpublish, status, sessionId } = useXmaxX21();

  const [reconcileNonce, setReconcileNonce] = useState(0);
  const [publishedTrack, setPublishedTrack] = useState<MediaStreamTrack | null>(
    null
  );
  const statusRef = useRef(status);
  statusRef.current = status;
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  // What the producer currently wants on the wire.
  const desiredRef = useRef<MediaStreamTrack | null>(null);
  // What this hook believes is on the wire. Cleared when the transport
  // goes away (status leaves "ready") so the next ready re-publishes.
  const publishedRef = useRef<MediaStreamTrack | null>(null);
  // True while a reconcile loop is in flight — guarantees a single writer.
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    desiredRef.current = track;
    if (status !== "ready") {
      publishedRef.current = null;
      setPublishedTrack(null);
      return;
    }

    const reconcile = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        // Converge on the latest desired track. The loop re-reads
        // desiredRef each pass, so a switch that lands mid-publish is
        // picked up by the same loop instead of spawning a second one.
        while (
          mountedRef.current &&
          statusRef.current === "ready" &&
          sessionRef.current === sessionId &&
          desiredRef.current !== publishedRef.current
        ) {
          const want = desiredRef.current;
          try {
            if (want) {
              await publish("source", want);
            } else {
              await unpublish("source");
            }
            if (
              !mountedRef.current ||
              statusRef.current !== "ready" ||
              sessionRef.current !== sessionId
            )
              break;
            publishedRef.current = want;
            setPublishedTrack(want);
          } catch (e) {
            // Leave publishedRef as-is and stop; the next track/status
            // change retries. Never spin on a failing transport.
            onError(e, want ? "publish.source" : "unpublish.source");
            break;
          }
        }
      } finally {
        busyRef.current = false;
        // A reconnect can arrive while an old publish is still settling.
        // Reconcile the new session once, without retrying failed commands.
        if (
          mountedRef.current &&
          statusRef.current === "ready" &&
          sessionRef.current !== sessionId
        ) {
          setReconcileNonce((value) => value + 1);
        }
      }
    };
    void reconcile();
  }, [track, status, sessionId, publish, unpublish, onError, reconcileNonce]);

  // Mount flag for the reconcile loop. Mount-once on purpose: tying this to
  // any dep (e.g. `unpublish`, whose identity changes when the provider
  // recreates its store on auth arrival) would flip it to false mid-session
  // and permanently kill publishing.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Free the slot if this hook owns it — on unmount, and when the store is
  // torn down and rebuilt (new `unpublish` identity means the old transport
  // this hook published on is going away).
  useEffect(
    () => () => {
      if (publishedRef.current && statusRef.current === "ready") {
        publishedRef.current = null;
        void unpublish("source").catch((error) =>
          onError(error, "unpublish.source")
        );
      }
    },
    [unpublish, onError]
  );
  return (
    status === "ready" &&
    track !== null &&
    track.readyState === "live" &&
    publishedTrack === track
  );
}
