"use client";

import { ConnectionPanel, type ConnectionState } from "./ConnectionPanel";
import { useHappyOysterClient } from "./ho-client";

// The connection badge every Reactor example carries at the top of its
// sidebar: a visible session state plus an explicit Connect/Disconnect,
// so the disconnected → connecting → connected transitions are seen,
// not hidden behind a spinner.
//
// Connecting here is optional — picking a world connects automatically —
// but pre-connecting takes the session handshake out of the build wait.
export function StatusBadge({
  onDisconnect,
}: {
  /** Override the plain disconnect, e.g. to also drop the pending intent. */
  onDisconnect?: () => void;
}) {
  const { phase, lastError, connect, disconnect } = useHappyOysterClient();
  const idle = phase === "idle" || phase === "ended" || phase === "failed";
  const state: ConnectionState =
    phase === "failed"
      ? "failed"
      : phase === "connecting"
        ? "connecting"
        : idle
          ? "disconnected"
          : "connected";
  return (
    <ConnectionPanel
      state={state}
      error={lastError}
      onToggle={() => {
        if (idle) void connect().catch(() => {});
        else if (onDisconnect) onDisconnect();
        else void disconnect().catch(() => {});
      }}
    />
  );
}
