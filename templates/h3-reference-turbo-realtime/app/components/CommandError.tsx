"use client";

import { useState } from "react";
import { useCommand } from "../lib/command";
import { useH3ClipFailed, useH3StateUpdate } from "../lib/model";

// Two different failures, both easy to miss if you don't show them.
//
// A refusal: the command never took effect. The model fails that command's
// own call with a code and a reason — a full generation queue, an unknown
// clip id, an empty prompt, a reference list outside 1–9. The SDK resolves
// the call `undefined` rather than throwing, so a try/catch will not see it;
// `run()` (lib/command.tsx) reads it off the call and holds it here until the
// next command succeeds.
//
// `clip_failed` is a build that started and then failed. That clip is dropped
// and the queue moves on, so nothing retries on its own.
export function CommandError() {
  const { refusal } = useCommand();
  const [failed, setFailed] = useState<string | null>(null);

  useH3ClipFailed((m) => setFailed(m.reason));
  // Any accepted state change means the user has moved on.
  useH3StateUpdate(() => setFailed(null));

  const note = refusal
    ? { label: `${refusal.command} refused`, reason: refusal.reason }
    : failed
      ? { label: "Clip failed to build", reason: failed }
      : null;
  if (!note) return null;
  return (
    <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">
      <span className="font-mono">{note.label}</span>: {note.reason}
    </div>
  );
}
