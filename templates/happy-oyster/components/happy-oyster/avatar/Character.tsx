"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExampleTile } from "../ExampleTile";
import { SectionLabel } from "../ui";
import { useActingSession } from "./ActingSession";
import { prepareToken } from "@/lib/reactor-auth";
import { AVATAR_PRESETS, type AvatarPreset } from "./lib/prompts";
import { startCharacter } from "./lib/character-flow";
import {
  loadPresetImage,
  resolveImageUrl,
  validateOpeningImage,
} from "./lib/opening-image";

export function Character({
  preset,
  onPresetChange,
  connectionBusy,
  onBusyChange,
}: {
  preset: AvatarPreset;
  onPresetChange: (preset: AvatarPreset) => void;
  connectionBusy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const acting = useActingSession();
  const { status, sessionState: snapshot } = acting;
  const [prompt, setPrompt] = useState<string>(preset.prompt);
  const [source, setSource] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [characterId, setCharacterId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function start(kind: "create" | "saved") {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("Checking character…");
    onBusyChange(true);
    setError(null);
    try {
      // Validate before connecting or making any model command.
      let selectedFile = file;
      let publicUrl: string | undefined;
      if (kind === "saved") {
        if (!characterId.trim()) throw new Error("Paste a character ID.");
      } else {
        if (!prompt.trim() || prompt.trim().length > 2000)
          throw new Error("Write a scene of 1–2,000 characters.");
        if (source === "url") {
          const image = resolveImageUrl(url, window.location.origin);
          if ("presetPath" in image) {
            selectedFile = await loadPresetImage(
              image.presetPath,
              controller.signal
            );
            setFile(selectedFile);
            setSource("file");
          } else publicUrl = image.publicUrl;
        }
        if (!publicUrl) {
          if (!selectedFile) throw new Error("Choose an image or a preset.");
          await validateOpeningImage(selectedFile, aspect);
        }
      }
      await startCharacter({
        client: acting,
        connect: acting.connect,
        prepareToken,
        signal: controller.signal,
        progress: setBusy,
        selection:
          kind === "saved"
            ? { kind: "saved", characterId: characterId.trim() }
            : {
                kind: "create",
                params: async () => {
                  const image =
                    selectedFile && !publicUrl
                      ? await acting.uploadFile(selectedFile)
                      : undefined;
                  if (!publicUrl && !image)
                    throw new Error("Image upload failed.");
                  return {
                    prompt: prompt.trim(),
                    resolution,
                    aspect_ratio: aspect,
                    ...(publicUrl
                      ? { first_frame_image_url: publicUrl }
                      : { first_frame_image: image }),
                  };
                },
              },
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(null);
        onBusyChange(false);
      }
    }
  }

  async function useExample(next: AvatarPreset) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("Loading image…");
    setError(null);
    try {
      const image = await loadPresetImage(next.image, controller.signal);
      if (controller.signal.aborted) return;
      setFile(image);
      setSource("file");
      setResolution(next.resolution);
      setAspect(next.aspect_ratio);
      setPrompt(next.prompt);
      onPresetChange(next);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(null);
      }
    }
  }

  const active = ["starting", "live", "paused", "ending"].includes(
    snapshot?.phase ?? ""
  );
  if (status === "ready" && active) return null;
  const disabled =
    !!busy ||
    connectionBusy ||
    !["disconnected", "ready"].includes(status) ||
    snapshot?.phase === "building";
  return (
    <>
      <section className="panel space-y-3">
        <SectionLabel>Example characters</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {AVATAR_PRESETS.map((example) => (
            <ExampleTile
              key={example.key}
              title={example.name}
              description={example.prompt}
              image={example.image}
              imagePosition={
                example.key === "realistic-cafe" ? "50% 17%" : "50% 38%"
              }
              selected={
                source === "file" &&
                file?.name === example.image.split("/").pop() &&
                preset.key === example.key
              }
              disabled={disabled}
              onClick={() => void useExample(example)}
            />
          ))}
        </div>
      </section>
      <section className="panel space-y-4">
        <SectionLabel>Compose your own</SectionLabel>
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs">Image</span>
              <button
                className="button !px-2 !py-1 !text-xs"
                onClick={() => setSource(source === "file" ? "url" : "file")}
              >
                {source === "file" ? "Use image URL" : "Upload image"}
              </button>
            </div>
            {source === "file" ? (
              <>
                {file && (
                  <div className="flex items-center gap-3 rounded-md border border-border p-2">
                    {preview && !/\.heic$/i.test(file.name) && (
                      <Image
                        src={preview}
                        alt="Selected opening image"
                        unoptimized
                        draggable={false}
                        width={40}
                        height={56}
                        className="h-14 w-10 shrink-0 rounded object-contain"
                      />
                    )}
                    <p className="muted min-w-0 break-all">{file.name}</p>
                  </div>
                )}
                <label className="button block text-center">
                  {file ? "Change image" : "Choose image"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,.heic"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </>
            ) : (
              <label className="block text-xs">
                Public image URL
                <input
                  className="field"
                  type="url"
                  value={url}
                  maxLength={2048}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
            )}
            <p className="muted">PNG, JPEG, WebP or HEIC · up to 30 MB</p>
          </div>
          <label className="block text-xs">
            Character & scene
            <textarea
              className="field min-h-32"
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              Resolution
              <select
                className="field"
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as typeof resolution)
                }
              >
                <option>480p</option>
                <option>720p</option>
              </select>
            </label>
            <label className="text-xs">
              Video shape
              <select
                className="field"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as typeof aspect)}
              >
                <option value="9:16">Portrait · 9:16</option>
                <option value="16:9">Landscape · 16:9</option>
              </select>
            </label>
          </div>

          <Button
            className="w-full"
            disabled={
              !prompt.trim() || (source === "file" ? !file : !url.trim())
            }
            onClick={() => void start("create")}
          >
            Create and start
          </Button>
        </fieldset>
        {busy && (
          <p className="muted" role="status">
            {busy}
          </p>
        )}
        {!busy && (
          <p className="muted">
            Creating a character can take several minutes.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
      </section>
      <section className="panel space-y-3">
        <SectionLabel>Return to a character</SectionLabel>
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          <input
            aria-label="Character ID"
            className="field !mt-0"
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
            placeholder="Paste character ID"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              className="ml-auto"
              disabled={!characterId.trim()}
              onClick={() => void start("saved")}
            >
              Start character
            </Button>
          </div>
        </fieldset>
      </section>
    </>
  );
}
