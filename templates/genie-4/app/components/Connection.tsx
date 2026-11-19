"use client";
import { Button, Panel } from "./ui";
import { useGenie4 } from "@reactor-models/genie-4";
import { useState } from "react";
export function Connection() {
  const { status, connect, disconnect, lastError, sessionId } = useGenie4();
  const [dismissed, setDismissed] = useState<typeof lastError>(undefined);
  const commandError = lastError?.operation === "sendCommand";
  return (
    <Panel variant="section" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm capitalize" role="status">
            {status === "waiting" ? "Waiting for session…" : status}
          </p>
        </div>
        {status === "disconnected" ? (
          <Button
            size="sm"
            onClick={() => {
              setDismissed(lastError);
              void connect();
            }}
          >
            Connect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new Event("genie4:cancel-launch"));
              void disconnect();
            }}
          >
            Disconnect
          </Button>
        )}
      </div>
      {lastError && lastError !== dismissed && (
        <div className="error" role="alert">
          <p className="font-semibold">
            {commandError ? "Command refused" : "Connection error"}
          </p>
          <p>
            {lastError.code}: {lastError.message}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 underline"
            onClick={() => setDismissed(lastError)}
          >
            Dismiss
          </Button>
        </div>
      )}
      {sessionId && (
        <details className="text-xs text-zinc-500">
          <summary>Session details</summary>
          <p className="mt-2 break-all">{sessionId}</p>
        </details>
      )}
    </Panel>
  );
}
