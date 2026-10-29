"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "disconnecting" | "failed";
const TONE: Record<ConnectionState, { dot: string; label: string }> = {
  disconnected: { dot: "bg-white/30", label: "Disconnected" },
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
  connected: { dot: "bg-emerald-400", label: "Connected" },
  disconnecting: { dot: "bg-amber-400 animate-pulse", label: "Disconnecting…" },
  failed: { dot: "bg-red-400", label: "Connection failed" },
};

export function ConnectionPanel({
  state,
  onToggle,
  disabled,
  buttonLabel,
  error,
  children,
}: {
  state: ConnectionState;
  onToggle: () => void;
  disabled?: boolean;
  buttonLabel?: string;
  error?: string | null;
  children?: ReactNode;
}) {
  const tone = TONE[state];
  const idle = state === "disconnected" || state === "failed";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2" role="status">
          <span aria-hidden className={`h-2 w-2 rounded-full ${tone.dot}`} />
          <span className="text-sm text-white/80">{tone.label}</span>
        </div>
        <Button
          size="sm"
          variant={idle ? "primary" : "ghost"}
          disabled={disabled}
          onClick={onToggle}
        >
          {buttonLabel ?? (idle ? "Connect" : "Disconnect")}
        </Button>
      </div>
      {children}
      {error && (
        <p
          role="alert"
          className="break-words text-xs leading-relaxed text-red-300/90"
        >
          {error}
        </p>
      )}
    </div>
  );
}
