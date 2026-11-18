"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/app/components/Toasts";
import { describeError, refusalCode } from "@/app/lib/errors";
import { TimeoutError, withTimeout } from "@/app/lib/timeout";
import {
  usePixverseR2Director,
  usePixverseR2DirectorClipFailed,
  usePixverseR2DirectorClipStarted,
  usePixverseR2DirectorSessionState,
} from "@reactor-models/pixverse-r2-director";
import type { PixverseR2DirectorSessionStateMessage } from "@reactor-models/pixverse-r2-director";
import { WORLD_PRESETS, type AspectRatio, type Style, type WorldPreset } from "./presets";

// The one place the Director flow lives.
//
// A session holds one world at a time. The flow the UI walks through:
//
//   connect → create_world (or attach_world) → enqueue scenes → they play
//
// Scenes build one at a time, each from the last frame of the one before,
// and a build takes about 1.3 times as long as the scene plays. Playing each
// scene the moment it is built would stall between scenes, so autoplay stays
// off until 30 seconds of scenes are ready, or nothing more is building, then
// turns on and plays them in order. The person never has to press play.
// Longer scenes keep up better: each one costs a few seconds on top of its
// length, so the opening scenes are 10 seconds.
//
// Everything the UI shows about the model comes from `session_state`, which
// is mirrored here once. It is cleared when the session is not `ready`: no
// final snapshot arrives on disconnect.

export type Snapshot = PixverseR2DirectorSessionStateMessage;
export type Clip = Snapshot["clips"][number];

export interface ReferenceImage {
  /** Identifies the image, so an unchanged world can be reused. */
  key: string;
  src: string;
  label: string;
  /** Set for an upload; a preset image is fetched from `src` when needed. */
  file: File | null;
}

export interface WorldSetup {
  presetID: string | null;
  description: string;
  style: Style;
  aspectRatio: AspectRatio;
  images: ReferenceImage[];
  openingScenes: string[];
}

export interface SceneRequest {
  prompt: string;
  seconds: number;
  /** Open on this reference image instead of continuing the last scene. */
  cutTo: number | null;
}

export type Busy = "connecting" | "creating" | null;

export const MAX_IMAGES = 6;
export const MAX_OPENING_SCENES = 4;
export const SCENE_SECONDS = 10;
const BUFFER_SECONDS = 30;
const FIRST_SNAPSHOT_TIMEOUT_MS = 20_000;
// Upper bounds well above how long each step takes when things work, so a
// stuck step ends with a message instead of a spinner.
const CONNECT_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 60_000;
// A connected session bills whether or not anything is generating.
const IDLE_DISCONNECT_MS = 5 * 60_000;

interface DirectorValue {
  status: string;
  snapshot: Snapshot | null;
  /** The scenes of the current world, oldest first. */
  scenes: Clip[];
  setup: WorldSetup;
  preset: WorldPreset | null;
  /** The images the current world was created with, for "cut to". */
  worldImages: ReferenceImage[];
  /** True while the setup panel is shown instead of the scene composer. */
  settingUp: boolean;
  busy: Busy;
  /** True once a scene has started playing in this session. */
  hasPlayed: boolean;
  /** Seconds of ready scenes against the buffer, while the first play waits for it. */
  buffering: { ready: number; target: number } | null;
  choosePreset: (id: string) => void;
  patchSetup: (patch: Partial<WorldSetup>) => void;
  addImages: (files: File[]) => void;
  removeImage: (key: string) => void;
  start: () => Promise<void>;
  /** Stop a world that is still being set up. */
  cancelStart: () => void;
  enqueue: (scene: SceneRequest) => Promise<boolean>;
  play: (clipID: string) => Promise<void>;
  stop: () => Promise<void>;
  remove: (clipID: string) => Promise<void>;
  newWorld: () => Promise<void>;
  cancelNewWorld: () => void;
}

const DirectorContext = createContext<DirectorValue | null>(null);

export function useDirector(): DirectorValue {
  const value = useContext(DirectorContext);
  if (!value) throw new Error("useDirector used outside DirectorSessionProvider");
  return value;
}

// The app opens blank: the person writes their own film or picks a preset.
const BLANK_SETUP: WorldSetup = {
  presetID: null,
  description: "",
  style: "Dramatic",
  aspectRatio: "16:9",
  images: [],
  openingScenes: [""],
};

function setupFromPreset(preset: WorldPreset): WorldSetup {
  return {
    presetID: preset.id,
    description: preset.description,
    style: preset.style,
    aspectRatio: preset.aspectRatio,
    images: preset.images.map((image) => ({ key: image.src, src: image.src, label: image.label, file: null })),
    openingScenes: [...preset.openingScenes],
  };
}

function worldKey(setup: WorldSetup): string {
  return JSON.stringify([setup.description.trim(), setup.style, setup.aspectRatio, setup.images.map((image) => image.key)]);
}

async function imageFile(image: ReferenceImage): Promise<File> {
  if (image.file) return image.file;
  const response = await fetch(image.src);
  if (!response.ok) throw new Error(`The image ${image.label} did not load.`);
  const blob = await response.blob();
  return new File([blob], image.src.split("/").pop() ?? "image.jpg", { type: blob.type });
}

export function DirectorSessionProvider({ children }: { children: ReactNode }) {
  const model = usePixverseR2Director();
  const { status, lastError } = model;
  // The hook returns a fresh object every render; async callbacks read it
  // through a ref so they always see the current one.
  const modelRef = useRef(model);
  modelRef.current = model;
  const toast = useToast();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [setup, setSetup] = useState<WorldSetup>(BLANK_SETUP);
  const [worldImages, setWorldImages] = useState<ReferenceImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [waitingForBuffer, setWaitingForBuffer] = useState(false);
  const [lastActivity, setLastActivity] = useState(() => Date.now());

  const statusRef = useRef(status);
  statusRef.current = status;
  const snapshotRef = useRef<Snapshot | null>(null);
  snapshotRef.current = snapshot;
  const firstSnapshotRef = useRef<(() => void) | null>(null);
  // Worlds made in this visit, by setup, so an unchanged world is attached
  // again instead of being created twice.
  const worldsRef = useRef(new Map<string, string>());
  const pendingWorldKeyRef = useRef<string | null>(null);
  // The session's clip list can still hold an earlier world's scenes; those
  // are left out of this world's reel.
  const [earlierClipIDs, setEarlierClipIDs] = useState<ReadonlySet<string>>(new Set());

  // ── The snapshot ─────────────────────────────────────────────────────────

  usePixverseR2DirectorSessionState((next) => {
    setSnapshot(next);
    firstSnapshotRef.current?.();
    firstSnapshotRef.current = null;
  });

  useEffect(() => {
    if (status === "ready") return;
    setSnapshot(null);
    setHasPlayed(false);
    setEarlierClipIDs(new Set());
    setBusy((current) => (current === "connecting" ? current : null));
  }, [status]);

  // Remember a world once the model reports it ready.
  useEffect(() => {
    const key = pendingWorldKeyRef.current;
    if (key && snapshot?.phase === "world_ready" && snapshot.world_id) {
      worldsRef.current.set(key, snapshot.world_id);
      pendingWorldKeyRef.current = null;
    }
  }, [snapshot?.phase, snapshot?.world_id]);

  usePixverseR2DirectorClipStarted(() => setHasPlayed(true));
  usePixverseR2DirectorClipFailed((message) => toast(message.reason));

  // A failure no command caused (the world could not be created, a run
  // ended on an error) arrives on the snapshot.
  const lastErrorKey = snapshot?.last_error
    ? `${snapshot.last_error.code}:${snapshot.last_error.trace_id ?? snapshot.last_error.reason}`
    : null;
  useEffect(() => {
    const error = snapshotRef.current?.last_error;
    if (!error) return;
    if (error.code === "world_not_found") worldsRef.current.clear();
    toast(error.reason);
  }, [lastErrorKey, toast]);

  // A refused command fails its own call; the SDK reports why on `lastError`
  // and <CommandError/> shows it in the sidebar. Only a failed connect is
  // worth a toast here.
  useEffect(() => {
    if (!lastError || refusalCode(lastError)) return;
    if (lastError.operation === "connect") toast(describeError(lastError));
  }, [lastError, toast]);

  // ── Setup ────────────────────────────────────────────────────────────────

  const choosePreset = useCallback((id: string) => {
    const preset = WORLD_PRESETS.find((entry) => entry.id === id);
    if (preset) setSetup(setupFromPreset(preset));
  }, []);

  const patchSetup = useCallback((patch: Partial<WorldSetup>) => {
    setSetup((current) => ({ ...current, ...patch }));
  }, []);

  const addImages = useCallback((files: File[]) => {
    setSetup((current) => {
      const room = MAX_IMAGES - current.images.length;
      const added = files.slice(0, room).map((file) => ({
        key: `upload:${file.name}:${file.size}:${file.lastModified}`,
        src: URL.createObjectURL(file),
        label: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "Image",
        file,
      }));
      return { ...current, presetID: null, images: [...current.images, ...added] };
    });
  }, []);

  const removeImage = useCallback((key: string) => {
    setSetup((current) => ({
      ...current,
      images: current.images.filter((image) => image.key !== key),
    }));
  }, []);

  // ── Starting ─────────────────────────────────────────────────────────────

  const connectAndWait = useCallback(async () => {
    if (statusRef.current === "ready") return;
    const first = new Promise<void>((resolve) => {
      firstSnapshotRef.current = resolve;
    });
    await modelRef.current.connect();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        first,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("The model did not answer. Try again.")), FIRST_SNAPSHOT_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // Each press of Generate is one attempt; Cancel or a timeout
  // ends it, and whatever the abandoned attempt was still awaiting is ignored.
  const attemptRef = useRef(0);

  const abandon = useCallback(async () => {
    attemptRef.current += 1;
    setBusy(null);
    setEditing(true);
    // A half-finished setup leaves the session in an unknown state; the next
    // attempt starts from a fresh one.
    await modelRef.current.disconnect().catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    const plan = setup;
    const scenes = plan.openingScenes.map((scene) => scene.trim()).filter(Boolean);
    if (!plan.description.trim() && plan.images.length === 0) {
      toast("Describe the film or add an image first.");
      return;
    }
    if (scenes.length === 0) {
      toast("Write at least one shot first.");
      return;
    }
    setLastActivity(Date.now());
    setHasPlayed(false);
    const attempt = ++attemptRef.current;
    const current = () => attempt === attemptRef.current;
    try {
      setBusy("connecting");
      await withTimeout(connectAndWait(), CONNECT_TIMEOUT_MS, "Could not connect. Try again.");
      if (!current()) return;
      await modelRef.current.setAutoplay({ enabled: false });
      setWaitingForBuffer(true);

      setBusy("creating");
      const key = worldKey(plan);
      const saved = worldsRef.current.get(key);
      if (saved && snapshotRef.current?.world_id === saved) {
        // This exact world is already current: just queue the scenes.
      } else if (saved) {
        await modelRef.current.attachWorld({ world_id: saved });
      } else {
        const references = await withTimeout(
          Promise.all(plan.images.map((image) => imageFile(image).then((file) => modelRef.current.uploadFile(file)))),
          UPLOAD_TIMEOUT_MS,
          "The images are taking too long to upload. Try again.",
        );
        if (!current()) return;
        pendingWorldKeyRef.current = key;
        await modelRef.current.createWorld({
          prompt: plan.description.trim(),
          style: plan.style,
          aspect_ratio: plan.aspectRatio,
          ...(references.length > 0 && { reference_images: references }),
        });
      }
      if (!current()) return;
      setEarlierClipIDs(new Set(snapshotRef.current?.clips.map((clip) => clip.clip_id)));
      setWorldImages(plan.images);
      setEditing(false);
      // Scenes queued now wait for the world, then play as they are built.
      // If the world was refused, the first enqueue fails too and stops here.
      for (const prompt of scenes.slice(0, MAX_OPENING_SCENES)) {
        const queued = await modelRef.current.enqueue({ prompt, seconds: SCENE_SECONDS });
        if (!queued || !current()) break;
      }
    } catch (error) {
      if (!current()) return;
      toast(error instanceof Error ? error.message : "Could not start. Try again.");
      if (error instanceof TimeoutError) await abandon();
    } finally {
      if (current()) setBusy(null);
    }
  }, [setup, connectAndWait, abandon, toast]);

  const cancelStart = useCallback(() => void abandon(), [abandon]);

  // ── Directing ────────────────────────────────────────────────────────────

  const enqueue = useCallback(async ({ prompt, seconds, cutTo }: SceneRequest) => {
    setLastActivity(Date.now());
    const queued = await modelRef.current.enqueue({
      prompt: prompt.trim(),
      seconds,
      ...(cutTo !== null && { first_frame_ref: cutTo }),
    });
    return queued !== undefined;
  }, []);

  const play = useCallback(async (clipID: string) => {
    setLastActivity(Date.now());
    if (snapshotRef.current?.playing_clip_id) await modelRef.current.stop();
    await modelRef.current.play({ clip_id: clipID });
  }, []);

  const stop = useCallback(async () => {
    await modelRef.current.stop();
  }, []);

  const remove = useCallback(async (clipID: string) => {
    await modelRef.current.pop({ clip_id: clipID });
  }, []);

  // A new world needs the current run closed. Scenes already built would
  // otherwise play over the next world, so they are removed too.
  const newWorld = useCallback(async () => {
    setEditing(true);
    if (statusRef.current !== "ready") return;
    const state = await modelRef.current.endRun();
    if (state?.playing_clip_id) await modelRef.current.stop();
    for (const clip of state?.clips ?? []) {
      if (clip.status === "ready") await modelRef.current.pop({ clip_id: clip.clip_id });
    }
  }, []);

  const cancelNewWorld = useCallback(() => setEditing(false), []);

  // ── Closing an idle session ──────────────────────────────────────────────

  const quiet =
    status === "ready" &&
    busy === null &&
    !snapshot?.playing_clip_id &&
    (snapshot?.pending_clips ?? 0) === 0 &&
    snapshot?.phase !== "creating_world";
  useEffect(() => {
    if (!quiet) return;
    const timer = setTimeout(() => {
      toast("Session closed after five quiet minutes. Press Generate to start again.", "info");
      setEditing(true);
      void modelRef.current.disconnect();
    }, IDLE_DISCONNECT_MS);
    return () => clearTimeout(timer);
  }, [quiet, lastActivity, toast]);

  // ── What the UI reads ────────────────────────────────────────────────────

  const live = status === "ready" ? snapshot : null;
  const scenes = useMemo(
    () => (live?.clips ?? []).filter((clip) => !earlierClipIDs.has(clip.clip_id)),
    [live?.clips, earlierClipIDs],
  );
  const hasWorld = !!live && (live.world_id !== null || live.phase === "creating_world");
  const settingUp = editing || !hasWorld;
  const preset = WORLD_PRESETS.find((entry) => entry.id === setup.presetID) ?? null;

  // The first play waits for the buffer. Once it is full, or the queue has
  // nothing more to build, autoplay turns on and the scenes play in order.
  const readySeconds = scenes.filter((clip) => clip.status === "ready").reduce((total, clip) => total + clip.seconds, 0);
  const buffered =
    readySeconds >= BUFFER_SECONDS || (readySeconds > 0 && (live?.pending_clips ?? 0) === 0);
  useEffect(() => {
    if (!waitingForBuffer || !buffered || status !== "ready") return;
    setWaitingForBuffer(false);
    void modelRef.current.setAutoplay({ enabled: true });
  }, [waitingForBuffer, buffered, status]);
  const buffering =
    waitingForBuffer && !hasPlayed && hasWorld ? { ready: readySeconds, target: BUFFER_SECONDS } : null;

  const value = useMemo<DirectorValue>(
    () => ({
      status,
      snapshot: live,
      scenes,
      setup,
      preset,
      worldImages,
      settingUp,
      busy,
      hasPlayed,
      buffering,
      choosePreset,
      patchSetup,
      addImages,
      removeImage,
      start,
      cancelStart,
      enqueue,
      play,
      stop,
      remove,
      newWorld,
      cancelNewWorld,
    }),
    [status, live, scenes, setup, preset, worldImages, settingUp, busy, hasPlayed, buffering, choosePreset, patchSetup, addImages, removeImage, start, cancelStart, enqueue, play, stop, remove, newWorld, cancelNewWorld],
  );

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}
