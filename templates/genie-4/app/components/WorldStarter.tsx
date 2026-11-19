"use client";
import Image from "next/image";
import { Button, Panel, FOCUS_RING } from "./ui";
import { useEffect, useRef, useState } from "react";
import {
  useGenie4,
  useGenie4SessionState,
  type Genie4SessionStateMessage,
} from "@reactor-models/genie-4";
import { SCENES } from "../lib/prompts";

type Scene = (typeof SCENES)[number];
type ReadyWaiter = {
  resolve: (sessionId: string) => void;
  reject: (error: Error) => void;
  sawConnection: boolean;
};

export function WorldStarter() {
  const api = useGenie4();
  const { status, sessionId } = api;
  const current = useRef(api);
  current.current = api;
  const [snapshot, setSnapshot] = useState<Genie4SessionStateMessage | null>(
    null
  );
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launching = useRef(false);
  const launchVersion = useRef(0);
  const readyWaiter = useRef<ReadyWaiter | null>(null);

  useGenie4SessionState((state) => {
    if (status === "ready") setSnapshot(state);
  });
  useEffect(() => {
    if (status === "disconnected") setCancelling(false);
    const waiter = readyWaiter.current;
    if (status === "ready" && sessionId) waiter?.resolve(sessionId);
    else if (status === "connecting" || status === "waiting") {
      if (waiter) waiter.sawConnection = true;
    } else if (waiter?.sawConnection) {
      waiter.reject(
        new Error("Connection ended before the world could start. Try again.")
      );
    }
    let cancelled = false;
    setSnapshot(null);
    if (status === "ready")
      void current.current.getState().then((state) => {
        if (!cancelled && state) setSnapshot(state);
      });
    return () => {
      cancelled = true;
    };
  }, [status, sessionId]);
  useEffect(() => {
    function cancel() {
      launchVersion.current += 1;
      setCancelling(true);
      launching.current = false;
      setBusy(null);
      setError(null);
      readyWaiter.current?.reject(new Error("World start cancelled."));
    }
    window.addEventListener("genie4:cancel-launch", cancel);
    return () => {
      window.removeEventListener("genie4:cancel-launch", cancel);
      launchVersion.current += 1;
      readyWaiter.current?.reject(new Error("World start cancelled."));
    };
  }, []);

  async function ensureReady(): Promise<string> {
    if (current.current.status === "ready" && current.current.sessionId)
      return current.current.sessionId;
    setBusy("Connecting…");
    let waiter: ReadyWaiter;
    const ready = new Promise<string>((resolve, reject) => {
      waiter = {
        resolve,
        reject,
        sawConnection: current.current.status !== "disconnected",
      };
      readyWaiter.current = waiter;
    });
    const timeout = window.setTimeout(
      () => waiter.reject(new Error("Connection took too long. Try again.")),
      60_000
    );
    try {
      // Listen for Ready before connecting so a fast connection cannot race us.
      const connect =
        current.current.status === "disconnected"
          ? current.current.connect()
          : Promise.resolve();
      const [, id] = await Promise.all([connect, ready]);
      return id;
    } finally {
      clearTimeout(timeout);
      if (readyWaiter.current === waiter!) readyWaiter.current = null;
    }
  }

  async function start(scene?: Scene) {
    if (launching.current || cancelling) return;
    launching.current = true;
    const version = ++launchVersion.current;
    setBusy("Preparing…");
    setError(null);
    if (scene) setPrompt(scene.prompt);
    try {
      const startingSession = await ensureReady();
      const stillCurrent = () =>
        version === launchVersion.current &&
        current.current.status === "ready" &&
        current.current.sessionId === startingSession;
      const state = await current.current.getState();
      if (!stillCurrent())
        throw new Error("Connection changed. Start the world again.");
      if (!state)
        throw new Error("Could not read the session state. Try again.");
      if (!["idle", "ended", "failed"].includes(state.phase))
        throw new Error("End the current world before starting another.");
      let openingFile = file;
      if (scene) {
        const response = await fetch(scene.imageUrl);
        if (!response.ok)
          throw new Error("Could not load the example image. Try again.");
        openingFile = new File([await response.blob()], `${scene.id}.png`, {
          type: "image/png",
        });
        if (!stillCurrent())
          throw new Error("Connection changed. Start the world again.");
        setFile(openingFile);
        if (fileInput.current) fileInput.current.value = "";
      }
      let reference_image;
      if (openingFile) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(openingFile.type)
        )
          throw new Error("Choose a PNG, JPEG or WEBP image.");
        if (openingFile.size > 20 * 1024 * 1024)
          throw new Error("Choose an image under 20 MiB.");
        const bitmap = await createImageBitmap(openingFile);
        const pixels = bitmap.width * bitmap.height;
        bitmap.close();
        if (pixels > 40_000_000)
          throw new Error("Choose an image under 40 megapixels.");
        if (!stillCurrent())
          throw new Error("Connection changed. Start the world again.");
        setBusy("Uploading image…");
        reference_image = await current.current.uploadFile(openingFile);
      }
      // Upload references belong to the session that created them. Never launch
      // a replacement connection using an earlier session's completed upload.
      if (!stillCurrent())
        throw new Error("Connection changed. Start the world again.");
      setBusy(scene ? `Starting ${scene.title}…` : "Starting world…");
      // Empty string is required for image-only input; explicitly undefined
      // becomes null in this release's serializer and is rejected.
      await current.current.startWorld({
        prompt: scene?.prompt ?? prompt.trim(),
        reference_image,
      });
      // No-reply command: session_state confirms the phase; SDK lastError
      // reports refusals visibly in the connection card.
    } catch (cause) {
      if (version === launchVersion.current)
        setError(
          cause instanceof Error ? cause.message : "Could not start this world."
        );
    } finally {
      if (version === launchVersion.current) {
        launching.current = false;
        setBusy(null);
      }
    }
  }

  if (
    status === "ready" &&
    snapshot &&
    ["starting", "live", "ending"].includes(snapshot.phase)
  )
    return null;
  return (
    <Panel variant="section" className="space-y-3">
      <div className="flex justify-end">
        <span
          className="font-mono text-xs tabular-nums text-zinc-400"
          aria-label="World time remaining"
        >
          60s
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            disabled={busy !== null || cancelling}
            aria-label={`Explore ${scene.title}`}
            onClick={() => void start(scene)}
            className={`group overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left transition hover:border-brand/60 disabled:cursor-wait disabled:opacity-40 ${FOCUS_RING}`}
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={scene.imageUrl}
                alt={scene.title}
                fill
                sizes="(min-width:1024px) 94px, 30vw"
                className="object-cover transition group-hover:scale-105"
              />
            </div>
            <span className="block px-1.5 py-1.5 text-[10px] leading-tight text-zinc-200">
              {scene.title}
            </span>
          </button>
        ))}
      </div>
      {busy && (
        <p role="status" className="text-xs text-zinc-400">
          {busy}
        </p>
      )}
      {cancelling && (
        <p role="status" className="text-xs text-zinc-400">
          Cancelling…
        </p>
      )}
      <div className="space-y-3 border-t border-zinc-800 pt-3">
        <label className="block text-xs text-zinc-300">
          Describe a place
          <textarea
            className="mt-2"
            rows={4}
            maxLength={2000}
            value={prompt}
            disabled={busy !== null || cancelling}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <label className="block text-xs text-zinc-300">
          Opening image <span className="text-zinc-500">(optional)</span>
          <input
            ref={fileInput}
            className="mt-2 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-md file:border file:border-zinc-700 file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy !== null || cancelling}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>
        {file && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null || cancelling}
              onClick={() => {
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              Remove
            </Button>
          </div>
        )}
        <p className="text-[11px] text-zinc-500">
          PNG, JPEG or WEBP · up to 20 MiB / 40 MP
        </p>
        <Button
          className="w-full"
          disabled={busy !== null || cancelling || (!prompt.trim() && !file)}
          onClick={() => void start()}
        >
          Start world
        </Button>
      </div>
      {snapshot?.last_error && (
        <div role="alert" className="error">
          <p>
            {snapshot.last_error.code}: {snapshot.last_error.reason}
          </p>
          <p>
            {snapshot.last_error.retryable
              ? "Try starting again."
              : "Try another prompt or image."}
          </p>
          {snapshot.last_error.trace_id && (
            <p className="mt-2 text-xs">
              World reference: {snapshot.last_error.trace_id}
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}
