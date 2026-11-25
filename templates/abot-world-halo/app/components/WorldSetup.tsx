"use client";
import { useEffect, useRef, useState } from "react";
import { useAbotWorldHalo, type FileRef } from "@reactor-models/abot-world-halo";
import { Button, Panel, FOCUS_RING, EYEBROW, cn } from "./ui";
import { REFERENCE_VIEWS, SCENES, type Scene } from "../lib/scenes";
import { settingsOf, useWorld, waitForState } from "../lib/world";
import { describeRefusal } from "../lib/refusals";

const ACCEPTED = ["image/png", "image/jpeg"];
const MAX_BYTES = 20 * 1024 * 1024;

type Picked = { file: File; preview: string };

async function fileFromUrl(url: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the example image. Try again.");
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function checkImage(file: File, maxRatio?: number) {
  if (!ACCEPTED.includes(file.type)) throw new Error(`${file.name}: choose a PNG or JPEG image.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: choose an image under 20 MiB.`);
  if (maxRatio) {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.max(bitmap.width, bitmap.height) / Math.min(bitmap.width, bitmap.height);
    bitmap.close();
    if (ratio > maxRatio)
      throw new Error(`${file.name}: character pictures can be at most 2:1. Crop it closer to square.`);
  }
}

function pick(file: File): Picked {
  return { file, preview: URL.createObjectURL(file) };
}

export function WorldSetup() {
  const api = useAbotWorldHalo();
  const current = useRef(api);
  current.current = api;
  const { status } = api;
  const { snapshot, latest } = useWorld();
  const [prompt, setPrompt] = useState("");
  const [firstFrame, setFirstFrame] = useState<Picked | null>(null);
  const [references, setReferences] = useState<(Picked | null)[]>(
    () => REFERENCE_VIEWS.map(() => null)
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const launch = useRef(0);
  const frameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cancel = () => {
      launch.current += 1;
      setBusy(null);
    };
    window.addEventListener("abot:cancel-launch", cancel);
    return () => window.removeEventListener("abot:cancel-launch", cancel);
  }, []);

  async function ensureReady(version: number) {
    if (current.current.status === "ready") return;
    setBusy("Connecting…");
    if (current.current.status === "disconnected") await current.current.connect();
    const started = Date.now();
    const connected = () => current.current.status === "ready" && !!latest.current;
    while (!connected()) {
      if (version !== launch.current) throw new Error("Start cancelled.");
      if (current.current.status === "disconnected" && Date.now() - started > 2000)
        throw new Error("Connection ended before the world could start. Try again.");
      if (Date.now() - started > 90_000) throw new Error("Connection took too long. Try again.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /** Runs one command and confirms it through the state_update it emits. */
  async function send(
    label: string,
    run: () => Promise<unknown>,
    accepted: (state: NonNullable<typeof latest.current>) => boolean
  ) {
    await run();
    if (!(await waitForState(latest, accepted))) {
      const refusal = current.current.lastError;
      throw new Error(
        refusal?.operation === "sendCommand"
          ? describeRefusal(refusal.code, refusal.message)
          : `${label} was not accepted. Try again.`
      );
    }
  }

  async function start(scene?: Scene) {
    if (busy) return;
    const version = ++launch.current;
    setError(null);
    try {
      let frame = firstFrame?.file ?? null;
      let views = references.filter((r): r is Picked => r !== null).map((r) => r.file);
      let text = prompt.trim();
      if (scene) {
        setBusy("Loading example…");
        frame = await fileFromUrl(scene.firstFrame, `${scene.id}.jpg`);
        views = await Promise.all(
          scene.references.map((url, i) => fileFromUrl(url, `${scene.id}-${i}.jpg`))
        );
        text = scene.prompt;
        setPrompt(text);
        setFirstFrame(pick(frame));
        setReferences(REFERENCE_VIEWS.map((_, i) => (views[i] ? pick(views[i]) : null)));
      }
      if (!frame) throw new Error("Add a first frame before starting.");
      if (!text) throw new Error("Describe the scene before starting.");
      await checkImage(frame);
      for (const view of views) await checkImage(view, 2);

      await ensureReady(version);
      const stillCurrent = () => {
        if (version !== launch.current) throw new Error("Start cancelled.");
      };
      const world = current.current;
      // Session setup is only accepted while idle; clear a finished world first.
      if (latest.current?.state !== "idle") {
        setBusy("Resetting…");
        await send("Reset", () => world.reset(), (s) => s.state === "idle");
      }
      stillCurrent();
      setBusy("Uploading first frame…");
      const image = await world.uploadFile(frame);
      stillCurrent();
      await send(
        "The first frame",
        () => world.setFirstFrame({ image }),
        (s) => settingsOf(s).first_frame_set === true
      );
      setBusy(views.length ? `Uploading ${views.length} character views…` : "Clearing character views…");
      const items: FileRef[] = [];
      for (const view of views) items.push(await world.uploadFile(view));
      stillCurrent();
      await send(
        "The character views",
        () => world.setReferences({ items }),
        (s) => settingsOf(s).references === items.length
      );
      await send(
        "The scene",
        () => world.setPrompt({ prompt: text }),
        (s) => settingsOf(s).prompt === text
      );
      stillCurrent();
      setBusy("Starting world…");
      await send("Start", () => world.start(), (s) => s.state !== "idle");
    } catch (cause) {
      if (version === launch.current)
        setError(cause instanceof Error ? cause.message : "Could not start this world.");
    } finally {
      if (version === launch.current) setBusy(null);
    }
  }

  async function onFrame(file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      await checkImage(file);
      setFirstFrame(pick(file));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function onReference(index: number, file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      await checkImage(file, 2);
      setReferences((list) => list.map((item, i) => (i === index ? pick(file) : item)));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (status === "ready" && snapshot && snapshot.state !== "idle") return null;
  const disabled = busy !== null;
  return (
    <Panel variant="section" className="space-y-3">
      <div>
        <p className="eyebrow">Pick a world</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              disabled={disabled}
              aria-label={`Play ${scene.name}`}
              title={scene.description}
              onClick={() => void start(scene)}
              className={`group overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left transition hover:border-brand/60 disabled:cursor-wait disabled:opacity-40 ${FOCUS_RING}`}
            >
              <div className="relative aspect-video overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.firstFrame}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <span className="block px-1.5 pt-1.5 text-[11px] font-medium leading-tight text-zinc-100">
                {scene.name}
              </span>
              <span className="block px-1.5 pb-1.5 pt-0.5 text-[10px] leading-snug text-zinc-500">
                {scene.description}
              </span>
            </button>
          ))}
        </div>
      </div>
      {busy && (
        <p role="status" className="text-xs text-zinc-400">
          {busy}
        </p>
      )}
      <div className="space-y-3">
        <p className="eyebrow">Build your own</p>
        <div>
          <span className="block text-xs text-zinc-300">First frame</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => frameInput.current?.click()}
            className={cn(
              "relative mt-2 flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-700 bg-zinc-950 text-xs text-zinc-500 hover:border-brand/60 disabled:opacity-40",
              FOCUS_RING
            )}
          >
            {firstFrame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firstFrame.preview} alt="First frame" className="h-full w-full object-cover" />
            ) : (
              "Choose an image (PNG or JPEG)"
            )}
          </button>
          <input
            ref={frameInput}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(event) => {
              void onFrame(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <p className="mt-1 text-[11px] text-zinc-500">Cropped to fill 832×480.</p>
        </div>
        <div>
          <span className="block text-xs text-zinc-300">
            Character views <span className="text-zinc-500">(optional, up to 5)</span>
          </span>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {REFERENCE_VIEWS.map((view, index) => {
              const item = references[index];
              return (
                <div key={view} className="space-y-1">
                  <label
                    className={cn(
                      "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-zinc-700 bg-zinc-950 text-lg text-zinc-600 hover:border-brand/60",
                      disabled && "pointer-events-none opacity-40"
                    )}
                    title={`${view} view`}
                  >
                    {item ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.preview} alt={`${view} view`} className="h-full w-full object-cover" />
                    ) : (
                      "+"
                    )}
                    <input
                      type="file"
                      accept={ACCEPTED.join(",")}
                      className="sr-only"
                      aria-label={`${view} view`}
                      onChange={(event) => {
                        void onReference(index, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <span className={cn(EYEBROW, "text-[9px]")}>{view}</span>
                    {item && (
                      <button
                        type="button"
                        aria-label={`Remove ${view} view`}
                        className="text-[10px] text-zinc-500 hover:text-zinc-200"
                        onClick={() =>
                          setReferences((list) => list.map((r, i) => (i === index ? null : r)))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Each at most 2:1.</p>
        </div>
        <label className="block text-xs text-zinc-300">
          Scene
          <textarea
            className="mt-2"
            rows={4}
            maxLength={4000}
            value={prompt}
            disabled={disabled}
            placeholder="A painterly valley of ivy-covered ruins, seen in third person."
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <Button
          className="w-full"
          disabled={disabled || !firstFrame || !prompt.trim()}
          onClick={() => void start()}
        >
          Start world
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}
