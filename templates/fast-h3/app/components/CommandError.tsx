"use client";

import { useCommand } from "../lib/command";

// The latest refused command and the model's reason: a full generation
// queue, an unknown clip id, an empty prompt. Every command in this app goes
// through `run()` (lib/command.tsx), which reads the refusal off the call that
// was refused. Surfacing it is non-negotiable: silent refusals are the #1
// confusion source. The next command that succeeds clears it.
export function CommandError() {
  const { refusal, dismiss } = useCommand();
  if (!refusal) return null;
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">
      <p>
        <span className="font-mono">{refusal.command}</span> refused:{" "}
        {refusal.reason}
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 text-red-400/70 hover:text-red-200"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
