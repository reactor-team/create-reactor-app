"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  PikaH3FlexMainVideoView,
  PikaH3FlexProvider,
  usePikaH3Flex,
  usePikaH3FlexMessage,
  usePikaH3FlexTrack,
  type PikaH3FlexEnqueueParams,
  type PikaH3FlexQueueUpdateMessage,
  type PikaH3FlexSetResolutionParams,
  type PikaH3FlexStateUpdateMessage,
} from "@reactor-models/pika-h3-flex";
import { Composer } from "./components/Composer";
import { Stage, type StageSnapshot } from "./components/Stage";
import { QueuePanel, type QueueSnapshot, type QueuedClip } from "./components/QueuePanel";
import { ContinueModePicker, WhatNext } from "./components/WhatNext";
import { LivePanel } from "./components/LivePanel";
import { RECENT_CLIPS } from "./lib/director";
import type { DirectorInfo } from "./lib/llm";
import { validateMedia } from "./lib/media";
import { frameContinuationPrompt } from "./lib/prompt";
import { DEFAULT_ASPECT, DEFAULT_RESOLUTION, nearestChoice, validateDraft, type ContinueMode, type SceneDraft } from "./lib/scene";
import { WRITTEN_CLIP_LIMIT, useLiveDirector } from "./useLiveDirector";

// `director` is set when the server has an LLM configured for live mode; it
// names the provider and model only, never the key.
type Props = { configured: boolean; director: DirectorInfo | null };

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

function stateFrom(state: PikaH3FlexStateUpdateMessage): StageSnapshot {
  return {
    resolution: state.resolution,
    resolution_choices: state.resolution_choices,
    width: state.width,
    height: state.height,
    aspect: state.aspect,
    generation_queued: state.generation_queued,
    playout_queued: state.playout_queued,
    playing: state.playing,
    autoplay: state.autoplay,
    clip_seconds_choices: state.clip_seconds_choices,
    valid_commands: state.valid_commands,
  };
}

function queueFrom(message: PikaH3FlexQueueUpdateMessage): QueueSnapshot {
  const clips = (items: PikaH3FlexQueueUpdateMessage["generation"]): QueuedClip[] => items.map(clip => ({
    clipId: clip.clip_id,
    prompt: clip.prompt,
    continued: Boolean(clip.continue_from_clip_id),
  }));
  return { generation: clips(message.generation), playout: clips(message.playout) };
}

export function Studio(props: Props) {
  return <PikaH3FlexProvider jwtToken={scopedToken}><StudioContent {...props} /></PikaH3FlexProvider>;
}

function StudioContent({ configured, director }: Props) {
  const model = usePikaH3Flex();
  const status = model.status;
  const audioTrack = usePikaH3FlexTrack("main_audio");
  // How "Continue this scene" continues the previous clip.
  const [continueMode, setContinueMode] = useState<ContinueMode>("frame");
  // The live status, for handlers that run after an await.
  const statusNow = useRef(status);
  statusNow.current = status;

  const lastDraft = useRef<SceneDraft | null>(null);
  // The opening scene: its prompt, and the draft whose references a latent
  // continuation keeps.
  const scenePrompt = useRef<string | null>(null);
  const sceneDraft = useRef<SceneDraft | null>(null);
  // The prompts queued most recently, oldest first, for the live director.
  const recentPrompts = useRef<string[]>([]);
  const builtIds = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement>(null);
  const [snapshot, setSnapshot] = useState<StageSnapshot | null>(null);
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  // The last clip built, and the last clip queued, which may still be building.
  const [latestClipId, setLatestClipId] = useState<string | null>(null);
  const [queuedClipId, setQueuedClipId] = useState<string | null>(null);
  const [phase, setPhase] = useState("Ready to generate");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const wasConnected = useRef(false);
  // generate() awaits connect() and then reads the latest state, which a
  // closure from before the await cannot see.
  const latest = useRef({ snapshot, queue });
  latest.current = { snapshot, queue };

  function forgetScene() {
    lastDraft.current = null;
    scenePrompt.current = null;
    sceneDraft.current = null;
    recentPrompts.current = [];
    builtIds.current = new Set();
  }

  function clearSession() {
    setSnapshot(null);
    setQueue(null);
    setLatestClipId(null);
    setQueuedClipId(null);
    forgetScene();
    setSoundBlocked(false);
    if (audio.current) audio.current.srcObject = null;
  }

  // Refusals are read off the failing call (below), not from the broadcast
  // command_error: that one also fires for refusals other clients caused.
  usePikaH3FlexMessage(message => {
    if (message.type === "state_update") {
      setSnapshot(stateFrom(message));
    } else if (message.type === "queue_update") {
      setQueue(queueFrom(message));
    } else if (message.type === "clip_generated") {
      builtIds.current.add(message.clip.clip_id);
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

  // The model broadcasts state_update and queue_update after each change but
  // not on connect, so ask once when the session becomes ready. The typed
  // hook returns new command functions on every render and every message
  // re-renders, so the effect keys on `status` alone and reads the functions
  // through a ref. Listing them as dependencies re-asks on every reply,
  // which loops without end.
  const ask = useRef({ getState: model.getState, getQueue: model.getQueue });
  ask.current = { getState: model.getState, getQueue: model.getQueue };
  useEffect(() => {
    if (status === "ready") {
      wasConnected.current = true;
      // A live session retires an error left by an earlier failed connect.
      setLastError(null);
      void ask.current.getState().then(state => { if (state) setSnapshot(stateFrom(state)); });
      void ask.current.getQueue().then(current => { if (current) setQueue(queueFrom(current)); });
    }
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

  // The SDK raises its error event before a refused command resolves
  // undefined, and lastError mirrors it with the model's code and reason.
  useEffect(() => {
    const error = model.lastError;
    if (!error) return;
    // A call that was already in flight when the session ended fails with
    // "requires a ready status". The status already says Offline; that
    // error adds nothing.
    if (statusNow.current !== "ready" && /requires a ready status/i.test(error.message)) return;
    setLastError(error.operation === "sendCommand"
      ? refusalText(error.command_code ?? error.code, error.message)
      : error.message || "Connection error.");
  }, [model.lastError]);

  async function connect() {
    if (status === "ready") return;
    if (!configured) throw new Error("Add REACTOR_API_KEY to .env.local, then restart the server.");
    setPhase("Connecting");
    try {
      await model.connect();
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function start() {
    setLastError(null);
    try {
      await connect();
      setPhase("Ready to generate");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Could not start a session.");
      setPhase("Disconnected");
    }
  }

  async function generate(draft: SceneDraft) {
    setLastError(null);
    setBusy(true);
    try {
      const draftErrors = validateDraft(draft, latest.current.snapshot?.clip_seconds_choices ?? null);
      if (draftErrors.length) throw new Error(draftErrors.join(" "));
      const mediaErrors = await validateMedia(draft);
      if (mediaErrors.length) throw new Error(mediaErrors.join(" "));
      await connect();
      // The canvas (aspect and resolution) can only change while nothing is
      // queued or playing, which is when the composer leaves those pickers enabled.
      const current = latest.current.snapshot;
      if (draft.aspect !== (current?.aspect ?? DEFAULT_ASPECT) && !isInFlight(current)) {
        setPhase("Setting the canvas");
        if (!await model.setCanvas({ aspect: draft.aspect })) throw new Error("The model refused the aspect ratio.");
      }
      if (draft.resolution !== (current?.resolution ?? DEFAULT_RESOLUTION) && !isInFlight(current)) {
        setPhase("Setting the resolution");
        if (!await model.setResolution({ resolution: draft.resolution as PikaH3FlexSetResolutionParams["resolution"] })) throw new Error("The model refused the resolution.");
      }
      // Lengths are the session's; a draft composed before it existed keeps
      // the closest one offered.
      const seconds = nearestChoice(draft.seconds, latest.current.snapshot?.clip_seconds_choices ?? []);
      setPhase("Uploading references");
      const images = [];
      for (const file of draft.images) images.push(await model.uploadFile(file));
      const audios = [];
      for (const file of draft.audio) audios.push(await model.uploadFile(file));
      const firstFrame = draft.firstFrame ? await model.uploadFile(draft.firstFrame) : null;
      const lastFrame = draft.lastFrame ? await model.uploadFile(draft.lastFrame) : null;
      const autoplay = await model.setAutoplay({ enabled: true });
      if (!autoplay) throw new Error("Could not enable autoplay.");
      // Hold the last frame between clips instead of cutting to black.
      await model.setFlushOnClipEnd({ enabled: false });
      setPhase("Queueing clip");
      const queued = await model.enqueue({
        prompt: draft.prompt.trim(),
        // One of state_update.clip_seconds_choices.
        seconds: seconds as PikaH3FlexEnqueueParams["seconds"],
        ...(images.length ? { reference_images: images } : {}),
        ...(audios.length ? { reference_audios: audios } : {}),
        // Frames never come with references or a continuation; validateDraft checks.
        ...(firstFrame ? { first_frame_image: firstFrame } : {}),
        ...(lastFrame ? { last_frame_image: lastFrame } : {}),
        ...(draft.continueFromClipId ? { continue_from_clip_id: draft.continueFromClipId, continue_mode: draft.continueMode } : {}),
      });
      if (!queued) throw new Error("The model refused this clip.");
      setQueuedClipId(queued.clip.clip_id);
      lastDraft.current = draft;
      if (!draft.continueFromClipId) {
        scenePrompt.current = draft.prompt;
        sceneDraft.current = { ...draft, seconds };
        recentPrompts.current = [];
      } else {
        recentPrompts.current = [...recentPrompts.current, draft.prompt.trim()].slice(-RECENT_CLIPS);
      }
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
      if (name === "play") await model.play({});
      if (name === "stop") await model.stop();
      if (name === "reset") {
        const reply = await model.reset();
        if (!reply) throw new Error("Could not reset the session.");
        setLatestClipId(null);
        setQueuedClipId(null);
        setSnapshot(null);
        setQueue(null);
        forgetScene();
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : `${name} failed.`);
    }
  }

  async function pop(clipId: string) {
    setLastError(null);
    await model.pop({ clip_id: clipId });
  }

  async function move(clipId: string, position: number) {
    setLastError(null);
    await model.move({ clip_id: clipId, position });
  }

  async function disconnect() {
    // An intentional disconnect clears the session here; the status effect
    // need not do it again (and would overwrite the phase that follows).
    wasConnected.current = false;
    await model.disconnect().catch(() => {});
    clearSession();
    setPhase("Disconnected");
  }

  // The next clip as a continuation of `from`. Latent keeps the scene's
  // references (the previous clip's tail takes the next audio label but no
  // slot); frame opens on the previous clip's last frame and sends none.
  function continuation(previous: SceneDraft, prompt: string, from: string, mode: ContinueMode = continueMode): SceneDraft {
    const frame = mode === "frame";
    const scene = sceneDraft.current ?? previous;
    return {
      ...previous,
      prompt,
      images: frame ? [] : scene.images,
      audio: frame ? [] : scene.audio,
      firstFrame: null,
      lastFrame: null,
      continueFromClipId: from,
      continueMode: mode,
    };
  }

  // A frame continuation may name a clip that is still building; the model
  // waits for it, so beats can be queued ahead and play with no gap. A latent
  // continuation needs a built clip.
  const continueFrom = continueMode === "frame" ? queuedClipId : latestClipId;

  async function continueScene(action: string) {
    if (!continueFrom || !lastDraft.current) throw new Error("Wait for a generated clip before continuing.");
    const previous = lastDraft.current;
    const scene = scenePrompt.current ?? previous.prompt;
    const prompt = continueMode === "frame" ? frameContinuationPrompt(scene, action) : `${scene}\nNext beat: ${action}`;
    await generate(continuation(previous, prompt, continueFrom));
  }

  // Live mode, when the server has an LLM: it writes and queues each next clip.
  const live = useLiveDirector({
    available: director !== null,
    ready: status === "ready",
    busy,
    tip: queuedClipId,
    built: latestClipId,
    builtIds: builtIds.current,
    listed: queue ? [...queue.generation, ...queue.playout].map(clip => clip.clipId) : [],
    mode: continueMode,
    scene: () => {
      const scene = sceneDraft.current;
      if (!scene || !scenePrompt.current) return null;
      return { scene: scenePrompt.current, recent: recentPrompts.current, seconds: scene.seconds, audios: scene.audio.length };
    },
    queueClip: async (prompt, from, mode) => {
      if (!lastDraft.current) throw new Error("The scene is gone.");
      await generate(continuation(lastDraft.current, prompt, from, mode));
    },
    setAutoplay: enabled => model.setAutoplay({ enabled }),
  });


  const tone = status === "ready" ? "bg-active animate-pulse" : status === "disconnected" ? "bg-zinc-500" : "bg-blue-500 animate-pulse";
  const statusLabel = status === "ready" ? "Connected" : status === "waiting" ? "Waiting for GPU…" : status === "connecting" ? "Connecting…" : "Offline";
  const inFlight = isInFlight(snapshot);
  const can = (command: string) => snapshot?.valid_commands.includes(command) ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">Pika H3 Flex</h1>
          <p className="hidden text-xs text-zinc-500 sm:block">Video clips with sound, from text, pictures, and audio.</p>
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
              {status === "disconnected"
                ? <button type="button" onClick={() => void start()} disabled={!configured || busy} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-40">Start</button>
                : <button type="button" onClick={() => void disconnect()} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300">Disconnect</button>}
            </div>
            {status === "disconnected" && <p className="mt-2 text-[11px] text-zinc-500">A live stream keeps a session running so clips play back to back. Start warms one up while you compose.</p>}
          </div>
          <Composer
            busy={busy}
            inFlight={inFlight}
            phase={phase}
            secondsChoices={snapshot?.clip_seconds_choices ?? null}
            canvasAspect={snapshot?.aspect ?? null}
            resolutionChoices={snapshot?.resolution_choices ?? null}
            canvasResolution={snapshot?.resolution ?? null}
            // set_resolution is in valid_commands only while the session is empty.
            canSetResolution={snapshot ? can("set_resolution") : true}
            onGenerate={generate}
          />
        </aside>
        <section className="order-first flex min-w-0 flex-1 flex-col gap-3 lg:order-none">
          <Stage
            status={status}
            snapshot={snapshot}
            video={<><PikaH3FlexMainVideoView className="h-full w-full" muted /><audio ref={audio} autoPlay /></>}
            phase={phase}
            lastError={lastError}
            onPlay={() => control("play")}
            onStop={() => control("stop")}
            onReset={() => control("reset")}
            onDisconnect={disconnect}
            playedOnce={latestClipId !== null}
          />
          {soundBlocked && (
            <button className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-xs" onClick={() => {
              if (audio.current) void audio.current.play().then(() => setSoundBlocked(false)).catch(() => setLastError("Your browser could not play the audio track."));
            }}>Enable sound</button>
          )}
          {status === "ready" && queuedClipId && <ContinueModePicker mode={continueMode} disabled={busy} onChange={setContinueMode} />}
          {director && status === "ready" && queuedClipId && (
            <LivePanel
              writer={`${director.provider} · ${director.model}`}
              live={live.live}
              writing={live.writing}
              waiting={live.waiting}
              clips={live.clips}
              limit={WRITTEN_CLIP_LIMIT}
              failure={live.failure}
              direction={live.direction}
              disabled={busy}
              onStart={live.start}
              onPause={() => live.pause()}
              onSteer={live.steer}
            />
          )}
          {status === "ready" && queuedClipId && !live.live && <WhatNext busy={busy || !continueFrom || (continueMode === "latent" && (snapshot?.generation_queued ?? 0) > 0)} mode={continueMode} onContinue={continueScene} />}
          {status === "ready" && (
            <QueuePanel
              queue={queue}
              canContinue={latestClipId !== null}
              canPop={can("pop")}
              canMove={can("move")}
              onPop={pop}
              onMove={move}
            />
          )}
        </section>
      </main>
    </div>
  );
}

// The model's refusal code, in words. invalid_request names a rule
// combination (frames with references, audio without a picture, …); the
// model's message says which.
function refusalText(code: string | undefined, message: string): string {
  if (code === "invalid_request") return `The model refused this request: ${message}`;
  if (code === "invalid_resolution") return `The model refused the resolution: ${message}`;
  if (code === "request_rejected") return `The prompt is over the model's 2,048-token budget: ${message}`;
  return `${code ?? "error"}: ${message}`;
}

function isInFlight(snapshot: StageSnapshot | null): boolean {
  return (snapshot?.generation_queued ?? 0) > 0 || (snapshot?.playout_queued ?? 0) > 0 || Boolean(snapshot?.playing);
}
