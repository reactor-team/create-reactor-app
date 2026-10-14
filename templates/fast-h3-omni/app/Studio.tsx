"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { FileRef } from "@reactor-team/js-sdk";
import {
  FastH3OmniMainVideoView,
  FastH3OmniProvider,
  useFastH3Omni,
  useFastH3OmniMessage,
  useFastH3OmniTrack,
  type FastH3OmniQueueUpdateMessage,
  type FastH3OmniStateUpdateMessage,
} from "@reactor-models/fast-h3-omni";
import { Composer } from "./components/Composer";
import { Stage, type StageSnapshot } from "./components/Stage";
import { QueuePanel, type QueueSnapshot, type QueuedClip } from "./components/QueuePanel";
import { WhatNext } from "./components/WhatNext";
import { CommandProvider, useCommand, useSessionError } from "./lib/command";
import { validateMedia } from "./lib/media";
import { validateDraft, type SceneDraft } from "./lib/scene";

type Props = { configured: boolean };
type Token = { jwt: string; expires_at: number };

let cachedToken: Token | null = null;
let pendingToken: Promise<Token> | null = null;

async function scopedToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at * 1000 > Date.now() + 60_000) return cachedToken.jwt;
  pendingToken ??= fetch("/api/reactor/token", { cache: "no-store" }).then(async response => {
    const data = await response.json() as Token & { error?: string };
    if (!response.ok || !data.jwt) throw new Error(data.error ?? "Could not create a session token.");
    return data;
  });
  try {
    cachedToken = await pendingToken;
    return cachedToken.jwt;
  } finally {
    pendingToken = null;
  }
}

function stateFrom(state: FastH3OmniStateUpdateMessage): StageSnapshot {
  return {
    width: state.width,
    height: state.height,
    generation_queued: state.generation_queued,
    playout_queued: state.playout_queued,
    playing: state.playing,
    autoplay: state.autoplay,
    valid_commands: state.valid_commands,
  };
}

function queueFrom(message: FastH3OmniQueueUpdateMessage): QueueSnapshot {
  const clips = (items: FastH3OmniQueueUpdateMessage["generation"]): QueuedClip[] => items.map(clip => ({
    clipId: clip.clip_id,
    prompt: clip.prompt,
    continued: clip.metadata === "continued",
  }));
  return { generation: clips(message.generation), playout: clips(message.playout) };
}

export function Studio({ configured }: Props) {
  return (
    <FastH3OmniProvider jwtToken={scopedToken}>
      <CommandProvider><StudioContent configured={configured} /></CommandProvider>
    </FastH3OmniProvider>
  );
}

function StudioContent({ configured }: Props) {
  const model = useFastH3Omni();
  const { run } = useCommand();
  const sessionError = useSessionError();
  const status = model.status;
  const audioTrack = useFastH3OmniTrack("main_audio");
  const lastDraft = useRef<SceneDraft | null>(null);
  const scenePrompt = useRef<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [snapshot, setSnapshot] = useState<StageSnapshot | null>(null);
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  const [latestClipId, setLatestClipId] = useState<string | null>(null);
  const [phase, setPhase] = useState("Ready to generate");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const wasConnected = useRef(false);

  function clearSession() {
    setSnapshot(null);
    setQueue(null);
    setLatestClipId(null);
    lastDraft.current = null;
    scenePrompt.current = null;
    setSoundBlocked(false);
    if (audio.current) audio.current.srcObject = null;
  }

  useFastH3OmniMessage(message => {
    if (message.type === "state_update") {
      setSnapshot(stateFrom(message));
    } else if (message.type === "queue_update") {
      setQueue(queueFrom(message));
    } else if (message.type === "clip_generated") {
      setLatestClipId(message.clip.clip_id);
      setPhase("Clip ready for playback");
    } else if (message.type === "clip_started") {
      setPhase("Playing");
    } else if (message.type === "clip_finished") {
      setPhase("Ready for another scene");
    } else if (message.type === "clip_failed") {
      setLastError(message.reason);
      setPhase("Request failed");
    }
  });

  useEffect(() => {
    if (status === "ready") wasConnected.current = true;
    if (status === "disconnected" && wasConnected.current) {
      wasConnected.current = false;
      clearSession();
      setPhase("Disconnected");
    }
  }, [status]);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (!audioTrack) {
      element.srcObject = null;
      return;
    }
    element.srcObject = new MediaStream([audioTrack]);
    void element.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    return () => { element.srcObject = null; };
  }, [audioTrack]);

  // Connection and transport failures only. A refused command fails its own
  // call, and `generate()` / `control()` report it from there.
  useEffect(() => {
    if (sessionError) setLastError(sessionError.message || "Connection error.");
  }, [sessionError]);

  async function connect() {
    if (status === "ready") return;
    if (!configured) throw new Error("Add REACTOR_API_KEY to .env.local, then restart the server.");
    setPhase("Connecting");
    try {
      await model.connect();
      const state = await model.getState();
      if (state) setSnapshot(stateFrom(state));
      const currentQueue = await model.getQueue();
      if (currentQueue) setQueue(queueFrom(currentQueue));
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function generate(draft: SceneDraft) {
    setLastError(null);
    setBusy(true);
    try {
      const draftErrors = validateDraft(draft);
      if (draftErrors.length) throw new Error(draftErrors.join(" "));
      const mediaErrors = await validateMedia(draft);
      if (mediaErrors.length) throw new Error(mediaErrors.join(" "));
      await connect();
      setPhase("Uploading references");
      const images: FileRef[] = [];
      for (const file of draft.images) images.push(await model.uploadFile(file));
      const audios: FileRef[] = [];
      for (const file of draft.audio) audios.push(await model.uploadFile(file));
      const autoplay = await run("set_autoplay", () => model.setAutoplay({ enabled: true }));
      if (!autoplay.ok) throw new Error(autoplay.refusal.reason);
      setPhase("Queueing clip");
      // A refusal fails this call with the model's code (`queue_full`,
      // `invalid_audio`) and a reason written for the person using the app.
      const queued = await run("enqueue", () => model.enqueue({
        prompt: draft.prompt.trim(),
        seconds: draft.seconds,
        metadata: draft.continueFromClipId ? "continued" : "",
        ...(images.length ? { reference_images: images } : {}),
        ...(audios.length ? { reference_audios: audios } : {}),
        ...(draft.continueFromClipId ? { continue_from_clip_id: draft.continueFromClipId } : {}),
      }));
      if (!queued.ok) throw new Error(queued.refusal.reason);
      lastDraft.current = draft;
      if (!draft.continueFromClipId) scenePrompt.current = draft.prompt;
      setPhase("Generating your clip");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not queue the clip.";
      setLastError(message);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function control(name: "play" | "stop" | "reset") {
    try {
      setLastError(null);
      if (name === "play") {
        const played = await run("play", () => model.play({}), { expectsReply: false });
        if (!played.ok) throw new Error(played.refusal.reason);
      }
      if (name === "stop") {
        const stopped = await run("stop", model.stop, { expectsReply: false });
        if (!stopped.ok) throw new Error(stopped.refusal.reason);
      }
      if (name === "reset") {
        const reset = await run("reset", model.reset);
        if (!reset.ok) throw new Error(reset.refusal.reason);
        setLatestClipId(null);
        setSnapshot(null);
        setQueue(null);
        lastDraft.current = null;
        scenePrompt.current = null;
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : `${name} failed.`);
    }
  }

  async function disconnect() {
    await model.disconnect().catch(() => {});
    clearSession();
    setPhase("Disconnected");
  }

  async function continueScene(action: string) {
    if (!latestClipId || !lastDraft.current) throw new Error("Wait for a generated clip before continuing.");
    const previous = lastDraft.current;
    await generate({
      ...previous,
      prompt: `${scenePrompt.current ?? previous.prompt}\nNext beat: ${action}`,
      continueFromClipId: latestClipId,
    });
  }

  const tone = status === "ready" ? "bg-active animate-pulse" : status === "disconnected" ? "bg-zinc-500" : "bg-blue-500 animate-pulse";
  const statusLabel = status === "ready" ? "Connected" : status === "waiting" ? "Waiting for GPU…" : status === "connecting" ? "Connecting…" : "Offline";
  const inFlight = (snapshot?.generation_queued ?? 0) > 0 || (snapshot?.playout_queued ?? 0) > 0 || Boolean(snapshot?.playing);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">FastH3-Omni</h1>
          <p className="hidden text-xs text-zinc-500 sm:block">Compose a scene from text, pictures, and sound.</p>
        </div>
        <span className="shrink-0">
          <Image src="/brand/reactor-symbol-white.svg" alt="Reactor" width={512} height={362} className="h-6 w-auto sm:hidden" />
          <Image src="/brand/reactor-logo-white.png" alt="Reactor" width={1600} height={184} className="hidden h-auto w-36 sm:block" />
        </span>
      </header>

      {!configured && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100 lg:mx-6" role="status">
          This is a layout preview. To generate a clip, put <code>REACTOR_API_KEY</code> in <code>.env.local</code>, then restart the server.
        </div>
      )}
      <main className="flex flex-1 flex-col gap-5 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <aside className="flex w-full flex-col gap-4 lg:w-[24rem] lg:shrink-0">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${tone}`} /><span className="text-sm text-zinc-200">{statusLabel}</span></div>
              {status !== "disconnected" && <button type="button" onClick={() => void disconnect()} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300">Disconnect</button>}
            </div>
          </div>
          <Composer busy={busy} inFlight={inFlight} phase={phase} onGenerate={generate} />
        </aside>
        <section className="order-first flex min-w-0 flex-1 flex-col gap-3 lg:order-none">
          <Stage
            status={status}
            snapshot={snapshot}
            video={<><FastH3OmniMainVideoView className="h-full w-full" muted /><audio ref={audio} autoPlay /></>}
            phase={phase}
            lastError={lastError}
            onPlay={() => control("play")}
            onStop={() => control("stop")}
            onReset={() => control("reset")}
            onDisconnect={disconnect}
          />
          {soundBlocked && (
            <button className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-xs" onClick={() => {
              if (audio.current) void audio.current.play().then(() => setSoundBlocked(false)).catch(() => setLastError("Your browser could not play the audio track."));
            }}>Enable sound</button>
          )}
          {status === "ready" && latestClipId && <WhatNext busy={busy || (snapshot?.generation_queued ?? 0) > 0} onContinue={continueScene} />}
          {status === "ready" && <QueuePanel queue={queue} canContinue={latestClipId !== null} />}
          <p className="font-mono text-[10px] text-zinc-600">{phase}</p>
        </section>
      </main>
    </div>
  );
}
