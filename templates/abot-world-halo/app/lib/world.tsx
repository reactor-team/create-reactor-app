"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  useAbotWorldHalo,
  useAbotWorldHaloChunkComplete,
  useAbotWorldHaloStateUpdate,
  type AbotWorldHaloChunkCompleteMessage,
  type AbotWorldHaloStateUpdateMessage,
} from "@reactor-models/abot-world-halo";

// The model sends the whole observable state in every `state_update`: on
// connect, after each accepted command and on the chunk that applies a change.
// Mirror the latest one and render from it.
type WorldState = {
  snapshot: AbotWorldHaloStateUpdateMessage | null;
  /** Always the newest snapshot, for code that runs after an await. */
  latest: RefObject<AbotWorldHaloStateUpdateMessage | null>;
  lastChunk: AbotWorldHaloChunkCompleteMessage | null;
};

const WorldContext = createContext<WorldState | null>(null);

export function WorldStateProvider({ children }: { children: ReactNode }) {
  const { status, sessionId } = useAbotWorldHalo();
  const [snapshot, setSnapshot] = useState<AbotWorldHaloStateUpdateMessage | null>(null);
  const [lastChunk, setLastChunk] = useState<AbotWorldHaloChunkCompleteMessage | null>(null);
  const latest = useRef<AbotWorldHaloStateUpdateMessage | null>(null);

  useAbotWorldHaloStateUpdate((message) => {
    latest.current = message;
    setSnapshot(message);
    if (message.state === "idle") setLastChunk(null);
  });
  useAbotWorldHaloChunkComplete((message) => setLastChunk(message));

  // A new connection gets its own state_update on join; drop the old one.
  useEffect(() => {
    if (status === "ready") return;
    latest.current = null;
    setSnapshot(null);
    setLastChunk(null);
  }, [status, sessionId]);

  return (
    <WorldContext.Provider value={{ snapshot, latest, lastChunk }}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorld() {
  const value = useContext(WorldContext);
  if (!value) throw new Error("useWorld must be used inside WorldStateProvider");
  return value;
}

/** Waits for the next state_update that satisfies `check`, or times out. */
export function waitForState(
  latest: RefObject<AbotWorldHaloStateUpdateMessage | null>,
  check: (state: AbotWorldHaloStateUpdateMessage) => boolean,
  timeoutMs = 4000
) {
  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (latest.current && check(latest.current)) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

// `settings` and `applied` are open objects in the schema; these are the
// fields model_behaviour.md documents.
export type WorldSettings = {
  first_frame_set?: boolean;
  references?: number;
  prompt?: string | null;
  move?: { forward: number; right: number };
  look?: { yaw: number; pitch: number };
  action?: { name: string; text?: string };
  paused?: boolean;
};
export type WorldApplied = {
  seed?: number;
  resolution?: string;
  action?: { name: string; text: string } | null;
  scene?: { text: string; live: boolean; tokens: number } | null;
  scene_max_tokens?: number | null;
};
export function settingsOf(state: AbotWorldHaloStateUpdateMessage | null) {
  return (state?.settings ?? {}) as WorldSettings;
}
export function appliedOf(state: AbotWorldHaloStateUpdateMessage | null) {
  return (state?.applied ?? {}) as WorldApplied;
}
