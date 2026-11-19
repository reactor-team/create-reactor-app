"use client";
import { useRef, useState } from "react";
import { useActingSession } from "./ActingSession";
import { ConnectionPanel, type ConnectionState } from "../ConnectionPanel";
import { prepareToken } from "@/lib/reactor-auth";

export function Connection({
  setupBusy = false,
  onBusyChange = () => {},
}: {
  setupBusy?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { status, connect, disconnect, lastError, sessionId } =
    useActingSession();
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The SDK retains its previous error after a successful fresh connection.
  // Ignore only that exact old value; newly emitted failures remain visible.
  const previousAttemptError = useRef<unknown>(undefined);
  const currentSdkError =
    lastError?.operation !== "sendCommand" &&
    lastError !== previousAttemptError.current
      ? lastError
      : undefined;
  async function toggle() {
    setBusy(status === "disconnected" ? "connect" : "disconnect");
    onBusyChange(true);
    setError(null);
    try {
      if (status === "disconnected") {
        previousAttemptError.current = lastError;
        await prepareToken();
        await connect();
      } else await disconnect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      onBusyChange(false);
    }
  }
  const state: ConnectionState =
    busy === "disconnect"
      ? "disconnecting"
      : status === "ready"
        ? "connected"
        : status === "disconnected"
          ? "disconnected"
          : "connecting";
  return (
    <ConnectionPanel
      state={state}
      onToggle={() => void toggle()}
      disabled={
        !!busy ||
        (status !== "ready" && (setupBusy || status !== "disconnected"))
      }
      buttonLabel={
        busy
          ? busy === "connect"
            ? "Connecting…"
            : "Disconnecting…"
          : undefined
      }
      error={error ?? (currentSdkError ? String(currentSdkError) : null)}
    >
      {status === "ready" && sessionId && (
        <details className="muted">
          <summary className="cursor-pointer">Session details</summary>
          <p className="break-all">{sessionId}</p>
        </details>
      )}
    </ConnectionPanel>
  );
}
