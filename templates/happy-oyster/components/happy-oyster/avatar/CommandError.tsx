"use client";
import { useActingSession } from "./ActingSession";

export function CommandError() {
  const { status, commandError, sessionState, lastError } = useActingSession();
  const nativeError =
    lastError?.operation === "sendCommand"
      ? {
          code: lastError.code,
          reason: lastError.message,
          command: "sendCommand",
          origin: "transport",
          retryable: false,
          trace_id: null,
        }
      : null;
  const error = commandError ?? sessionState?.last_error ?? nativeError;
  if (status !== "ready" || !error) return null;
  return (
    <section className="panel border-red-400/40 space-y-2" role="alert">
      <p className="text-sm text-red-200">
        {String(error.code ?? "Command failed")}
      </p>
      <p className="text-xs">
        {String(error.reason ?? "The command could not be completed.")}
      </p>
      <p className="muted">
        {String(error.command ?? "session")} ·{" "}
        {String(error.origin ?? "unknown")} ·{" "}
        {error.retryable ? "Can retry" : "Check input or state"}
      </p>
      {error.trace_id != null && (
        <p className="muted break-all">Trace: {String(error.trace_id)}</p>
      )}
    </section>
  );
}
