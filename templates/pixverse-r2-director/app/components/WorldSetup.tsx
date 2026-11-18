"use client";

import { useRef } from "react";
import { PlayIcon, PlusIcon, XIcon } from "@/app/components/icons";
import {
  Button,
  cn,
  FOCUS_RING,
  INPUT,
  Label,
  Panel,
  SegmentedToggle,
  Spinner,
} from "@/app/components/ui";
import { ASPECT_OPTIONS, STYLE_OPTIONS, WORLD_PRESETS } from "@/app/lib/presets";
import { MAX_IMAGES, MAX_OPENING_SCENES, useDirector } from "@/app/lib/session";

/** Step one: describe the film and list its shots, then generate. */
export function WorldSetup() {
  const { setup, patchSetup, choosePreset, addImages, removeImage, start, cancelStart, busy, snapshot, cancelNewWorld } =
    useDirector();
  const fileInput = useRef<HTMLInputElement>(null);
  const scenes = setup.openingScenes;
  const canCancel = !!snapshot?.world_id;

  const setScene = (index: number, text: string) =>
    patchSetup({ openingScenes: scenes.map((scene, i) => (i === index ? text : scene)) });

  return (
    <>
      <Panel label="Film">
        <div className="grid grid-cols-3 gap-2">
          {WORLD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => choosePreset(preset.id)}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-md ring-1 transition",
                setup.presetID === preset.id ? "ring-2 ring-brand" : "ring-zinc-700 hover:ring-zinc-500",
                FOCUS_RING,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preset.images[0].src} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-medium">
                {preset.title}
              </span>
            </button>
          ))}
        </div>
        <textarea
          aria-label="Description"
          value={setup.description}
          onChange={(event) => patchSetup({ description: event.target.value })}
          rows={4}
          maxLength={2000}
          placeholder="The place, the people in it, the light, the mood…"
          className={cn(INPUT, "mt-2 resize-none leading-relaxed")}
        />
      </Panel>

      <Panel label="Reference images">
        <div className="flex flex-wrap gap-2">
          {setup.images.map((image, index) => (
            <div key={image.key} className="group relative h-14 w-20 overflow-hidden rounded-md ring-1 ring-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.label} className="h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[9px] uppercase tracking-wide text-zinc-200">
                  Opening
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(image.key)}
                className="absolute right-1 top-1 hidden rounded bg-black/70 p-0.5 text-zinc-200 group-hover:block"
                aria-label={`Remove ${image.label}`}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
          {setup.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={cn(
                "flex h-14 w-20 items-center justify-center rounded-md border border-dashed border-zinc-700 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300",
                FOCUS_RING,
              )}
              aria-label="Add images"
            >
              <PlusIcon />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(event) => {
              addImages(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>
      </Panel>

      <Panel>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <Label>Style</Label>
            <SegmentedToggle
              aria-label="Style"
              value={setup.style}
              options={[...STYLE_OPTIONS]}
              onChange={(style) => patchSetup({ style })}
            />
          </div>
          <div>
            <Label>Orientation</Label>
            <SegmentedToggle
              aria-label="Orientation"
              value={setup.aspectRatio}
              options={[...ASPECT_OPTIONS]}
              onChange={(aspectRatio) => patchSetup({ aspectRatio })}
            />
          </div>
        </div>
      </Panel>

      <Panel label="Shots">
        <ol className="flex flex-col gap-1.5">
          {scenes.map((scene, index) => (
            <li key={index} className="group flex items-start gap-2">
              <span className="mt-2 w-4 shrink-0 text-right font-mono text-[11px] text-zinc-600">{index + 1}</span>
              <textarea
                aria-label={`Shot ${index + 1}`}
                value={scene}
                onChange={(event) => setScene(index, event.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="What happens in this shot…"
                className={cn(INPUT, "resize-none py-1.5 text-[13px] leading-snug [field-sizing:content]")}
              />
              <button
                type="button"
                onClick={() => patchSetup({ openingScenes: scenes.filter((_, i) => i !== index) })}
                className="mt-2 text-zinc-600 opacity-0 transition hover:text-zinc-300 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove shot"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
        {scenes.length < MAX_OPENING_SCENES && (
          <button
            type="button"
            onClick={() => patchSetup({ openingScenes: [...scenes, ""] })}
            className={cn("ml-6 mt-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300", FOCUS_RING)}
          >
            + Add a shot
          </button>
        )}
      </Panel>

      <div className="flex gap-2">
        {busy !== null ? (
          <Button variant="secondary" size="lg" onClick={cancelStart}>
            Cancel
          </Button>
        ) : (
          canCancel && (
            <Button variant="secondary" size="lg" onClick={cancelNewWorld}>
              Back
            </Button>
          )
        )}
        <Button size="lg" className="flex-1" onClick={() => void start()} disabled={busy !== null}>
          {busy ? (
            <>
              <Spinner /> {busy === "connecting" ? "Connecting…" : "Setting up…"}
            </>
          ) : (
            <>
              <PlayIcon /> Generate
            </>
          )}
        </Button>
      </div>
    </>
  );
}
