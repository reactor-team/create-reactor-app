"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, PhoneIcon, PlayIcon, StopIcon, UploadIcon } from "@/app/components/icons";
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
import { CHARACTER_PRESETS, SAMPLED_VOICES, voiceSampleURL } from "@/app/lib/presets";
import { usePersona } from "@/app/lib/session";

const BUSY_TEXT = {
  connecting: "Connecting…",
  uploading: "Sending the portrait…",
  creating: "Creating the character…",
  starting: "Calling…",
  ending: "Hanging up…",
} as const;

/** Who to call: pick or describe a character, then call it. */
export function CharacterSetup() {
  const { setup, patchSetup, choosePreset, choosePortrait, voices, busy, call, cancel, sameCharacter, snapshot } =
    usePersona();
  const fileInput = useRef<HTMLInputElement>(null);
  const name = setup.name.trim();
  const calledBefore = snapshot?.phase === "ended" || snapshot?.phase === "failed";
  const uploaded = setup.presetID === null ? setup.portrait : null;

  return (
    <>
      <Panel label="Character">
        <div className="grid grid-cols-4 gap-2">
          {CHARACTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => choosePreset(preset.id)}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-md ring-1 transition",
                setup.presetID === preset.id ? "ring-2 ring-brand" : "ring-zinc-700 hover:ring-zinc-500",
                FOCUS_RING,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preset.image} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-medium">
                {preset.name}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={cn(
              "relative flex aspect-[3/4] flex-col items-center justify-center gap-1 overflow-hidden rounded-md text-zinc-500 transition hover:text-zinc-300",
              uploaded ? "ring-2 ring-brand" : "border border-dashed border-zinc-700 hover:border-zinc-500",
              FOCUS_RING,
            )}
            aria-label="Use your own photo"
          >
            {uploaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploaded.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <UploadIcon />
                <span className="text-[11px]">Your photo</span>
              </>
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) choosePortrait(file);
              event.target.value = "";
            }}
          />
        </div>
      </Panel>

      <Panel>
        <div className="grid grid-cols-[1fr_11rem] gap-3">
          <div>
            <Label>Name</Label>
            <input
              aria-label="Name"
              value={setup.name}
              onChange={(event) => patchSetup({ name: event.target.value })}
              maxLength={20}
              placeholder="Ava"
              className={INPUT}
            />
          </div>
          <div>
            <Label>Voice</Label>
            <div className="flex gap-1.5">
              {/* The browser's own arrow sits against the border; this one keeps the field's padding. */}
              <div className="relative min-w-0 flex-1">
                <select
                  aria-label="Voice"
                  value={setup.voice}
                  onChange={(event) => patchSetup({ voice: event.target.value })}
                  className={cn(INPUT, "h-[38px] appearance-none py-0 pr-8")}
                >
                  {!voices.some((entry) => entry.voice === setup.voice) && (
                    <option value={setup.voice}>{setup.voice || "Default"}</option>
                  )}
                  {voices.map((entry) => (
                    <option key={entry.voice} value={entry.voice} title={entry.description}>
                      {entry.voice}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              </div>
              <VoiceSample voice={setup.voice} />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Label>Persona</Label>
          <textarea
            aria-label="Persona"
            value={setup.persona}
            onChange={(event) => patchSetup({ persona: event.target.value })}
            rows={6}
            maxLength={4000}
            placeholder="Who they are, what they know, how they behave…"
            className={cn(INPUT, "resize-none leading-relaxed")}
          />
        </div>
        <details className="group mt-3">
          <summary className={cn("cursor-pointer list-none rounded text-xs text-zinc-500 hover:text-zinc-300", FOCUS_RING)}>
            <span className="inline-block transition group-open:rotate-90">›</span> More options
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <Label>Speaking style</Label>
              <textarea
                aria-label="Speaking style"
                value={setup.speakingStyle}
                onChange={(event) => patchSetup({ speakingStyle: event.target.value })}
                rows={2}
                maxLength={1000}
                placeholder="Language, tone, and how long the answers are"
                className={cn(INPUT, "resize-none")}
              />
            </div>
            <div>
              <Label>Shape</Label>
              <SegmentedToggle
                aria-label="Shape"
                value={setup.aspectRatio}
                options={[
                  { value: "9:16", label: "Portrait 9:16" },
                  { value: "16:9", label: "Landscape 16:9" },
                ]}
                onChange={(aspectRatio) => patchSetup({ aspectRatio })}
              />
            </div>
          </div>
        </details>
      </Panel>

      <div className="flex gap-2">
        {busy !== null && busy !== "ending" && (
          <Button variant="secondary" size="lg" onClick={cancel}>
            Cancel
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={() => void call()} disabled={busy !== null}>
          {busy ? (
            <>
              <Spinner /> {BUSY_TEXT[busy]}
            </>
          ) : (
            <>
              <PhoneIcon /> {!name ? "Call" : calledBefore && sameCharacter ? `Call ${name} again` : `Call ${name}`}
            </>
          )}
        </Button>
      </div>
    </>
  );
}

/** Plays the voice's recorded greeting, when it has one, so a voice can be heard before the call. */
function VoiceSample({ voice }: { voice: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const sampled = SAMPLED_VOICES.has(voice);

  // Picking another voice stops the one playing.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      setPlaying(false);
    },
    [voice],
  );

  function toggle() {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = new Audio(voiceSampleURL(voice));
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!sampled}
      aria-label={playing ? "Stop the sample" : `Hear ${voice}`}
      title={sampled ? (playing ? "Stop the sample" : `Hear ${voice}`) : "No sample for this voice"}
      className={cn(
        "flex size-[38px] shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40",
        FOCUS_RING,
      )}
    >
      {playing ? <StopIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
    </button>
  );
}
