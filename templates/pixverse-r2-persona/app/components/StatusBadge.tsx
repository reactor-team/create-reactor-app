"use client";

import { useReactor } from "@reactor-team/js-sdk";
import { useEffect, useState } from "react";
import { Button, Panel, cn } from "./ui";

const TONE: Record<string, { dot: string; label: string }> = {
  disconnected: { dot: "bg-zinc-500", label: "Disconnected" },
  connecting: { dot: "bg-blue-500 animate-pulse", label: "Preparing session…" },
  waiting: { dot: "bg-blue-500 animate-pulse", label: "Waiting for session…" },
  ready: { dot: "bg-active animate-pulse", label: "Connected" },
};

// The connection lifecycle. It reads the generic store rather than the
// model's typed hook, so it works unchanged for any Reactor model. The
// primary button connects on its own; Connect here lets you watch the
// session come up first, and Disconnect ends it (and its billing) whenever
// you like.
export function StatusBadge() {
  const { status, sessionId, connect, disconnect } = useReactor((s) => ({
    status: s.status,
    sessionId: s.sessionId,
    connect: s.connect,
    disconnect: s.disconnect,
  }));
  const [busy, setBusy] = useState(false);
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

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      // A failed connect lands on the store's lastError, which the session
      // provider turns into a toast; nothing to do here.
      await action().catch(() => undefined);
    } finally {
      setBusy(false);
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
          <Button size="sm" disabled={busy} onClick={() => void run(connect)}>
            Connect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void run(disconnect)}
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </Button>
        )}
      </div>
      {sessionId && (
        <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
          Session: {sessionId}
        </p>
      )}
    </Panel>
  );
}
