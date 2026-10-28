"use client";

import { useEffect, useRef, useState } from "react";
import { useXmaxX21 } from "@reactor-models/xmax-x2-1";
import { PRESET_IMAGES } from "@/app/lib/clips";
import { Panel, cn, EYEBROW, FOCUS_RING } from "./ui";
import type { DiagnosticReporter } from "@/app/lib/errors";

// Reference-image panel for character/object insertion or swap. Picking an
// image uploads it via the SDK's presigned-URL protocol (uploadFile) and then
// sends set_reference_image with the returned FileRef. The awaited call answers
// with `reference_image_accepted`, or `undefined` for an undecodable file — the
// reason then lands on the SDK's `lastError`, which the shell banners.
//
// Reference swaps apply to the current run with one short output pause.
// Await acceptance before updating the preview; do not reset the session.
export function ReferenceImage({
  generating,
  hasReference,
  accepted,
  onAccepted,
  onError,
  onBusyChange,
}: {
  generating: boolean;
  hasReference: boolean;
  accepted: { width: number; height: number } | null;
  /** The decoded dimensions the model answered with, lifted to the shell. */
  onAccepted: (size: { width: number; height: number }) => void;
  onError: DiagnosticReporter;
  onBusyChange: (busy: boolean) => void;
}) {
  const { uploadFile, setReferenceImage, status } = useXmaxX21();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = status === "ready";
  const busyRef = useRef(false);
  const disabled = !ready || busy;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function apply(loadFile: () => Promise<File>) {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    onBusyChange(true);
    setBusy(true);
    setError(null);
    let operation = "load_reference";
    try {
      const file = await loadFile();
      operation = "uploadFile";
      const ref = await uploadFile(file, { name: file.name });
      // Resolves with `reference_image_accepted`, carrying the dimensions the
      // model actually decoded. `undefined` means it refused — the reason is on
      // the SDK's `lastError`, which the shell banners.
      operation = "set_reference_image";
      const accepted = await setReferenceImage({ reference_image: ref });
      if (!accepted) return;
      onAccepted({ width: accepted.width, height: accepted.height });
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } catch (err) {
      onError(err, operation);
      setError("Reference change failed. See error history.");
    } finally {
      busyRef.current = false;
      onBusyChange(false);
      setBusy(false);
    }
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (file) await apply(async () => file);
  }

  // Demo refs ship as static assets; fetch one back into a File so it goes
  // through the exact same upload path as a user-picked image.
  async function pickPreset(preset: (typeof PRESET_IMAGES)[number]) {
    if (disabled) return;
    await apply(async () => {
      const response = await fetch(preset.src);
      if (!response.ok)
        throw new Error(`Reference asset returned HTTP ${response.status}`);
      const blob = await response.blob();
      return new File([blob], `${preset.id}.jpg`, { type: "image/jpeg" });
    });
  }

  return (
    <Panel label="Reference image">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESET_IMAGES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => void pickPreset(preset)}
            className={cn(
              "rounded-md border border-zinc-700 p-1 transition hover:border-zinc-500 disabled:opacity-40 disabled:pointer-events-none",
              FOCUS_RING
            )}
            aria-label={`Use demo reference: ${preset.label}`}
            title={preset.label}
          >
            {/* Plain <img>: tiny demo thumbnails, no next/image pipeline needed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preset.src}
              alt={preset.label}
              className="h-10 w-10 rounded object-cover"
            />
          </button>
        ))}
      </div>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-zinc-700 p-3 transition hover:border-zinc-500",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          disabled={disabled}
          accept="image/*"
          onChange={(e) => void pick(e)}
          className="hidden"
        />
        {previewUrl ? (
          // Plain <img>: the preview is a transient blob URL, not an asset
          // next/image could optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Reference"
            className="h-14 w-14 shrink-0 rounded border border-zinc-800 object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-zinc-800 text-lg text-zinc-600">
            +
          </span>
        )}
        <span className="min-w-0">
          <span className={EYEBROW}>
            {busy
              ? "uploading…"
              : previewUrl
                ? "replace image"
                : "add an image"}
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Character or object to insert / swap in.
          </span>
        </span>
      </label>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {accepted && !error && hasReference && (
        <p className="mt-2 text-xs text-zinc-500">
          Accepted ({accepted.width}×{accepted.height}).{" "}
          {generating
            ? "Applies to the current run with one short output pause."
            : "Will condition the next run."}
        </p>
      )}
    </Panel>
  );
}
