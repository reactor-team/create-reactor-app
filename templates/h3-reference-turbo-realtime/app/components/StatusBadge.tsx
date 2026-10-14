"use client";

import { useSessionError } from "../lib/command";
import { useH3 } from "../lib/model";

// A single line above the stage. Connecting is not a user action here — the
// composer connects when you generate — so this reports and does not offer a
// button. Ending the session lives with the other transport controls.
//
// The error is the connection's only. A refused command shows in
// <CommandError />, so this reads `useSessionError()` rather than the SDK's
// `lastError`, which also holds command refusals.
const TONE: Record<string, { dot: string; label: string }> = {
  disconnected: { dot: "bg-zinc-600", label: "Not connected" },
  connecting: { dot: "bg-blue-500 animate-pulse", label: "Connecting" },
  waiting: { dot: "bg-blue-500 animate-pulse", label: "Waiting for a GPU" },
  ready: { dot: "bg-active", label: "Session live" },
};

export function StatusBadge() {
  const { status } = useH3();
  const lastError = useSessionError();
  const tone = TONE[status] ?? TONE.disconnected;

  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <span className="text-[11px] text-zinc-500">{tone.label}</span>
      {lastError && (
        <span className="truncate text-[11px] text-red-400">
          · {lastError.message}
        </span>
      )}
    </div>
  );
}
