"use client";
import { Button, Panel } from "./ui";
import { useAbotWorldHalo } from "@reactor-models/abot-world-halo";
import { describeRefusal } from "../lib/refusals";
import { useWorld } from "../lib/world";
import { useState } from "react";
export function Connection() {
  const { status, connect, disconnect, lastError, sessionId } = useAbotWorldHalo();
  const [dismissed, setDismissed] = useState<typeof lastError>(undefined);
  const { snapshot } = useWorld();
  const commandError = lastError?.operation === "sendCommand";
  const startFailed = snapshot?.error;
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
              // lastError shows the failure; the rejection needs no other handling.
              connect().catch(() => {});
            }}
          >
            Connect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new Event("abot:cancel-launch"));
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
            {commandError
              ? describeRefusal(lastError.code, lastError.message)
              : /\b(401|403)\b/.test(lastError.message)
                ? "Reactor did not accept the API key. Check that REACTOR_API_KEY has ABot World Halo access."
                : lastError.message}
          </p>
          <p className="mt-1 font-mono text-[10px] text-red-400/70">
            {lastError.code}
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
      {startFailed && (
        <div className="error" role="alert">
          <p className="font-semibold">World could not start</p>
          <p>{describeRefusal(startFailed.code, startFailed.message)}</p>
          {startFailed.message && (
            <p className="mt-1 text-red-400/70">{startFailed.message}</p>
          )}
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
