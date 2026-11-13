"use client";

import { useEffect, useRef, useState } from "react";
import type { DirectorRequest } from "./lib/director";
import { frameContinuationFromWritten } from "./lib/prompt";
import type { ContinueMode } from "./lib/scene";

/** The writer pauses after this many clips; Go live again to continue. */
export const WRITTEN_CLIP_LIMIT = 20;

/** What the writer needs to know about the stream it continues. */
export type LiveScene = Omit<DirectorRequest, "direction" | "mode">;

type Options = {
  /** An LLM is configured on the server. */
  available: boolean;
  ready: boolean;
  /** A clip is being queued (by the director or by hand). */
  busy: boolean;
  /** The last clip queued, which may still be building. */
  tip: string | null;
  /** The last clip built. */
  built: string | null;
  builtIds: ReadonlySet<string>;
  /** Clip ids in the generation and playout queues, as queue_update last listed them. */
  listed: string[];
  mode: ContinueMode;
  scene: () => LiveScene | null;
  queueClip: (prompt: string, from: string, mode: ContinueMode) => Promise<void>;
  setAutoplay: (enabled: boolean) => Promise<unknown>;
};

type Written = { from: string; prompt: string; mode: ContinueMode };

// The live director keeps the stream going: it writes clip N+1 while clip N
// still builds, so a finished build never waits on the LLM, and stops while
// two clips already wait ahead of playback, which keeps a new direction about
// one clip from the screen. A frame continuation may name a clip that is still
// building, so in frame mode a written prompt is queued at once, continuing
// from the last *queued* clip; a latent one waits for that clip to finish.
export function useLiveDirector(options: Options) {
  const { available, ready, busy, tip, built, builtIds, listed, mode } = options;
  const [live, setLive] = useState(false);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState<Written | null>(null);
  const [clips, setClips] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  // The clip the current or last written prompt continues: write once per tip.
  const writtenFrom = useRef<string | null>(null);
  const writer = useRef<AbortController | null>(null);
  const queueing = useRef(false);
  // The effects below run on state changes; these read the latest values.
  const latest = useRef(options);
  latest.current = options;
  const directionNow = useRef(direction);
  directionNow.current = direction;

  // The clip just queued counts toward the two ahead even before queue_update
  // lists it; without that, the writer races to a third.
  const tipUnlisted = tip !== null && !builtIds.has(tip) && !listed.includes(tip);
  const ahead = listed.length + (tipUnlisted ? 1 : 0);
  const roomToWrite = ahead <= 1;

  function stopWriting() {
    writer.current?.abort();
    writer.current = null;
    writtenFrom.current = null;
    setWritten(null);
    setWriting(false);
  }

  /** Stop writing and stop autoplay; `reason` says why when it was not asked for. */
  function pause(reason: string | null = null) {
    stopWriting();
    setLive(false);
    setFailure(reason);
    void latest.current.setAutoplay(false).catch(() => {});
  }

  function start() {
    stopWriting();
    setClips(0);
    setFailure(null);
    setLive(true);
    void latest.current.setAutoplay(true).catch(() => {});
  }

  /** A new direction: drop any prompt written but not queued and write the next clip from it. Never resets, stops, or clears the queue. */
  function steer(text: string) {
    stopWriting();
    setFailure(null);
    setDirection(text.trim());
  }

  // A reset or a lost session ends the stream this director was writing.
  useEffect(() => {
    if (ready && tip !== null) return;
    writer.current?.abort();
    writer.current = null;
    writtenFrom.current = null;
    queueing.current = false;
    setWritten(null);
    setWriting(false);
    setLive(false);
    setClips(0);
    setDirection("");
  }, [ready, tip]);

  async function write(from: string, scene: LiveScene, writeMode: ContinueMode) {
    writtenFrom.current = from;
    const controller = new AbortController();
    writer.current = controller;
    setWriting(true);
    setFailure(null);
    try {
      const request: DirectorRequest = { ...scene, direction: directionNow.current, mode: writeMode };
      const response = await fetch("/api/director", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await response.json().catch(() => ({})) as { prompt?: string; error?: string };
      if (!response.ok || !data.prompt) throw new Error(data.error ?? `The director returned ${response.status}.`);
      if (controller.signal.aborted) return;
      const prompt = writeMode === "frame" ? frameContinuationFromWritten(data.prompt) : data.prompt;
      setWritten({ from, prompt, mode: writeMode });
    } catch (error) {
      if (controller.signal.aborted) return;
      pause(`The director stopped: ${error instanceof Error ? error.message : "the LLM call failed."}`);
    } finally {
      if (writer.current === controller) {
        writer.current = null;
        setWriting(false);
      }
    }
  }

  // Write the next clip when there is room ahead of playback.
  useEffect(() => {
    if (!available || !live || writing || busy || !ready) return;
    if (written !== null || !roomToWrite || tip === null || tip === writtenFrom.current) return;
    if (clips >= WRITTEN_CLIP_LIMIT) {
      pause(`Paused after ${WRITTEN_CLIP_LIMIT} clips. Go live to keep going.`);
      return;
    }
    const scene = latest.current.scene();
    if (scene) void write(tip, scene, mode);
    // write and pause read the latest values through refs
  }, [available, live, writing, busy, ready, written, roomToWrite, tip, clips, mode]);

  // Queue a written prompt: a frame one at once, a latent one once its clip is built.
  useEffect(() => {
    if (written === null || queueing.current || !live || busy || !ready) return;
    if (written.from !== tip) {
      // Something else was queued meanwhile; write again from the new tip.
      writtenFrom.current = null;
      setWritten(null);
      return;
    }
    if (written.mode === "latent" && built !== written.from) return;
    queueing.current = true;
    void (async () => {
      try {
        await latest.current.queueClip(written.prompt, written.from, written.mode);
        setClips(count => count + 1);
      } catch (error) {
        pause(`The director stopped: ${error instanceof Error ? error.message : "the model refused the clip."}`);
      } finally {
        setWritten(null);
        queueing.current = false;
      }
    })();
    // pause reads the latest values through refs
  }, [written, tip, built, live, busy, ready]);

  return { live, writing, waiting: live && !writing && written === null && !roomToWrite, clips, failure, direction, ahead, start, pause, steer };
}
