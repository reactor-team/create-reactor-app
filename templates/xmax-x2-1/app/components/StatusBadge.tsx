"use client";

import { useEffect, useRef, useState } from "react";
import { useXmaxX21 } from "@reactor-models/xmax-x2-1";
import type { DiagnosticEntry, DiagnosticReporter } from "@/app/lib/errors";
import { Button, Panel, cn } from "./ui";

const TONE: Record<string, { dot: string; label: string }> = {
  disconnected: { dot: "bg-zinc-500", label: "Disconnected" },
  connecting: { dot: "bg-blue-500 animate-pulse", label: "Preparing session…" },
  waiting: { dot: "bg-blue-500 animate-pulse", label: "Waiting for session…" },
  ready: { dot: "bg-active animate-pulse", label: "Connected" },
};

export function StatusBadge({
  errors,
  sessionId,
  onError,
  onClear,
}: {
  errors: DiagnosticEntry[];
  sessionId: string | null;
  onError: DiagnosticReporter;
  onClear: () => void;
}) {
  const { status, connect, disconnect } = useXmaxX21();
  const attemptRef = useRef(false);
  const [attempting, setAttempting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const waiting = status === "connecting" || status === "waiting";
  useEffect(() => {
    setElapsed(0);
    if (!waiting) return;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [waiting]);

  async function handleConnect() {
    if (attemptRef.current || status !== "disconnected") return;
    attemptRef.current = true;
    setAttempting(true);
    try {
      await connect();
    } catch (error) {
      onError(error, "connect");
    } finally {
      attemptRef.current = false;
      setAttempting(false);
    }
  }

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnect();
    } catch (error) {
      onError(error, "disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  const tone = TONE[status] ?? TONE.disconnected;
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
          <span className="text-sm text-zinc-200">
            {tone.label}
            {waiting ? ` ${elapsed}s` : ""}
          </span>
        </div>
        {status === "disconnected" ? (
          <Button
            variant="primary"
            size="sm"
            disabled={attempting}
            onClick={() => void handleConnect()}
          >
            Connect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={disconnecting}
            onClick={() => void handleDisconnect()}
          >
            {disconnecting ? "Disconnect requested…" : "Disconnect"}
          </Button>
        )}
      </div>
      {waiting && (
        <p className="mt-2 text-xs text-zinc-500">
          Session preparation includes queueing and connection setup. Disconnect
          may finish after setup completes.
        </p>
      )}
      {sessionId && (
        <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
          Last session: {sessionId}
        </p>
      )}
      {errors.length > 0 && (
        <section
          className="mt-3 border-t border-red-900/50 pt-3"
          aria-label="Error history"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-red-400">
              Last 5 errors · kept across disconnect
            </span>
            <Button size="sm" variant="secondary" onClick={onClear}>
              Clear
            </Button>
          </div>
          <ol className="mt-2 space-y-3" role="log" aria-live="polite">
            {errors.map((error) => (
              <li key={error.id} className="break-words text-xs text-red-300">
                <div className="font-mono">
                  <time dateTime={new Date(error.at).toISOString()}>
                    {new Date(error.at).toLocaleTimeString()}
                  </time>{" "}
                  · {error.code} · {error.operation}
                </div>
                <p className="mt-0.5">{error.message}</p>
                {(error.status !== undefined ||
                  error.recoverable !== undefined) && (
                  <p className="mt-0.5 font-mono text-[10px]">
                    {error.status !== undefined ? `HTTP ${error.status}` : ""}
                    {error.recoverable !== undefined
                      ? ` · recoverable: ${error.recoverable}`
                      : ""}
                  </p>
                )}
                {error.cause && (
                  <p className="mt-0.5">
                    Cause: {error.cause.name ? `${error.cause.name}: ` : ""}
                    {error.cause.message}
                  </p>
                )}
                {error.sessionId && (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">
                    Session: {error.sessionId}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </Panel>
  );
}
