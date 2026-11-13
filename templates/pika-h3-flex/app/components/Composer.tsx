"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ASPECTS,
  DEFAULT_ASPECT,
  DEFAULT_CLIP_SECONDS,
  DEFAULT_RESOLUTION,
  MAX_AUDIO,
  MAX_IMAGES,
  PROMPT_TOKEN_BUDGET,
  estimatePromptTokens,
  nearestChoice,
  validateDraft,
  type Aspect,
  type ClipSeconds,
  type SceneDraft,
} from "../lib/scene";
import {
  assembleBasicPrompt,
  assembleFramePrompt,
  frameSet,
  type AudioRole,
  type NamedAudio,
  type NamedPicture,
  type PictureKind,
} from "../lib/prompt";

type Props = {
  busy: boolean;
  inFlight: boolean;
  phase: string;
  /** `state_update.clip_seconds_choices`, or null before a session exists. */
  secondsChoices: readonly number[] | null;
  /** The session's canvas, or null before a session exists. */
  canvasAspect: string | null;
  /** `state_update.resolution_choices` and `resolution`, or null before a session exists. */
  resolutionChoices: readonly string[] | null;
  canvasResolution: string | null;
  /** Whether `set_resolution` is in `valid_commands` (the session is empty). */
  canSetResolution: boolean;
  onGenerate: (draft: SceneDraft) => Promise<void>;
};

type ExampleFile = { src: string; fileName: string };
type SceneIdea = {
  name: string;
  /** Card thumbnail; text-only scenes have none. */
  image?: string;
  seconds: ClipSeconds;
  aspect: Aspect;
  /** The description, using picture names, not labels. */
  text: string;
  /** A hand-written prompt; the card then opens with the prompt taken over. */
  prompt?: string;
  pictures: (ExampleFile & NamedPicture)[];
  audios: (ExampleFile & NamedAudio)[];
};

// Four starting scenes, one per shape of request:
//   1. text only, one continuous shot
//   2. one reference picture, several shots, a narrator
//   3. several character references in conversation
//   4. pictures with voice references
// The images were generated for this template; the voices with ElevenLabs.
const IDEAS: SceneIdea[] = [
  {
    name: "Treehouse",
    seconds: 14.375,
    aspect: "16:9",
    text: [
      "Hand-drawn 2D animated cartoon, warm watercolour textures, soft golden afternoon light, a gentle storybook palette.",
      "In a big old oak tree in a backyard, a girl of about eight in a red bandana and overalls hammers the last plank onto a small wooden treehouse, climbs through the doorway, pulls up the rope ladder and pokes her head out of the window, grinning, as a paper flag unfurls on the roof. Then she waves down at the camera and blows a soap bubble that drifts toward the lens.",
      "One continuous shot: the camera starts low at the foot of the tree and slowly cranes up the trunk, ending level with her in the window and holding there as she waves.",
      "Everything moves at normal real-time speed, with no slow motion.",
      "Sound: three hammer taps, creaking wood, leaves rustling, birdsong, the rope ladder thumping against the trunk, a happy laugh.",
      "Music: a light, bouncy ukulele and glockenspiel tune that swells as the flag unfurls.",
    ].join("\n"),
    pictures: [],
    audios: [],
  },
  {
    name: "Product reveal",
    image: "/examples/product-reveal/motorcycle.jpg",
    seconds: 14.375,
    aspect: "16:9",
    text: [
      "A high-end cinematic launch film for Bike on the salt flats at golden hour: pale white salt against a deep copper hero, large soft low sunlight, long soft shadows, low-to-moderate contrast, creamy highlights, subtle 35mm film grain, shallow depth of field, an anamorphic feel. The camera always moves with bold, confident motion: cranes, dollies, macro orbits. One clear story from start to end.",
      "[Shot 1] A crane move descends over the empty salt flats onto Bike standing alone, its long shadow stretching across the cracked crust as the sun crests the horizon.",
      "[Shot 2] At 00:03.000, cut to an extreme macro side angle gliding along the copper frame and battery fins, low sun rolling across the brushed copper, salt crystals glittering on the tyre.",
      "[Shot 3] At 00:05.500, cut to a low tracking shot at speed: a rider in a sand-white suit and helmet races Bike across the flats, the LED light bar blazing, a plume of white salt dust behind, the background streaked with motion blur.",
      "[Shot 4] At 00:09.000, cut to directly overhead: Bike carves one long sweeping arc, leaving a curved white trail in the salt.",
      "[Shot 5] At 00:11.500, cut to a low dolly gliding across and settling on the final hero frame exactly like <Picture 1>.",
      "Keep Bike exactly the same in every shot: the sand-white body, copper frame and LED light bar. Bike is always tack-sharp and recognisable. Correct real-world physics. Everything moves at normal real-time speed, with no slow motion. No on-screen text, titles, captions, or subtitles.",
      "Sound: wind across the flats, the rising electric whine of the motor, tyres hissing on salt, a sharp whoosh as it passes, then quiet. No dialogue, no voiceover.",
      "Music: a polished, pulsing electronic score that builds through the ride and lands on the final shot.",
    ].join("\n"),
    pictures: [
      { src: "/examples/product-reveal/motorcycle.jpg", name: "Bike", kind: "object", description: "the electric motorcycle, sand-white body, copper frame, LED light bar", fileName: "motorcycle.jpg" },
    ],
    audios: [],
  },
  {
    name: "Sitcom",
    image: "/examples/sitcom/apartment.jpg",
    seconds: 14.375,
    aspect: "4:3",
    text: [
      "A 1990s multi-camera sitcom: bright even studio lighting, a slightly soft video image, warm colours, a live studio audience.",
      "[Shot 1] A wide shot of the Apartment. Marcy and Dev sit on the orange sofa sharing a pizza. Dev says nervously (S1), <d>[English] He said the rent is going up again.</d> Marcy waves a slice and says (S2), <d>[English] Relax. I have a plan.</d>",
      "[Shot 2] At 00:05.000, cut to the front door: it swings open, and Gus walks in jingling his keys and says flatly (S3), <d>[English] The plan better include rent.</d>",
      "[Shot 3] At 00:09.000, cut back to the sofa in a medium two-shot: Marcy freezes mid-bite and Dev slowly sinks behind a cushion.",
      "Exactly three people. Keep Marcy, Dev and Gus exactly the same in every shot. Real people speak with natural lip-sync. Everything moves at normal real-time speed, with no slow motion.",
      "Sound: the studio audience laughs after each line and roars at the end, the door creaks, keys jingle, sofa springs squeak.",
      "Music: a short, bouncy slap-bass sitcom sting on the final shot.",
    ].join("\n"),
    pictures: [
      { src: "/examples/sitcom/marcy.jpg", name: "Marcy", kind: "person", description: "curly red hair, a stonewashed denim jacket over a mustard turtleneck", fileName: "marcy.jpg" },
      { src: "/examples/sitcom/dev.jpg", name: "Dev", kind: "person", description: "round tortoiseshell glasses, a brown cardigan over a checked shirt", fileName: "dev.jpg" },
      { src: "/examples/sitcom/gus.jpg", name: "Gus", kind: "person", description: "the bald, moustached landlord in a teal bowling shirt", fileName: "gus.jpg" },
      { src: "/examples/sitcom/apartment.jpg", name: "Apartment", kind: "setting", description: "a 1990s sitcom living room with an orange sofa", fileName: "apartment.jpg" },
    ],
    audios: [],
  },
  {
    name: "Food truck",
    image: "/examples/food-truck/nora.jpg",
    seconds: 8,
    aspect: "9:16",
    text: [
      "Night, light rain, warm string lights over a street food truck, cinematic shallow depth of field.",
      "[Shot 1] Nora steps up to the service window, shakes the rain off her hood and says with a wry smile (S1), <d>[English] The usual. And don't skimp on the hot sauce this time.</d>",
      "[Shot 2] At 00:04.000, cut to Theo leaning out of the window, grinning, as he slides a paper tray of tacos toward her and says (S2), <d>[English] Extra hot. For my favourite critic.</d>",
      "Real people speak with natural lip-sync. Only these two lines. Everything moves at normal real-time speed, with no slow motion.",
      "Sound: rain pattering on the truck's awning, sizzling from the grill, distant traffic.",
      "Music: none.",
    ].join("\n"),
    pictures: [
      { src: "/examples/food-truck/nora.jpg", name: "Nora", kind: "person", description: "a silver bob and a bright yellow raincoat", fileName: "nora.jpg" },
      { src: "/examples/food-truck/theo.jpg", name: "Theo", kind: "person", description: "a green beanie and a canvas apron", fileName: "theo.jpg" },
    ],
    audios: [
      { src: "/examples/food-truck/nora.mp3", fileName: "nora.mp3", role: "voice", speaker: "Nora" },
      { src: "/examples/food-truck/theo.mp3", fileName: "theo.mp3", role: "voice", speaker: "Theo" },
    ],
  },
];

const LABEL = "text-[10px] font-medium uppercase tracking-wider text-zinc-500";
const FIELD = "w-full rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600";

async function exampleFile(asset: ExampleFile, type: string): Promise<File> {
  const response = await fetch(asset.src);
  if (!response.ok) throw new Error(`Could not load ${asset.fileName}.`);
  return new File([await response.blob()], asset.fileName, { type });
}

function PictureCard({ file, index, picture, disabled, named, onPictureChange, onRemove }: {
  file: File;
  index: number;
  picture: NamedPicture;
  disabled: boolean;
  /** Names are used while the prompt is built automatically. */
  named: boolean;
  onPictureChange: (change: Partial<NamedPicture>) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="flex gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-950">
        {preview && <img src={preview} alt={`Picture ${index + 1} preview`} className="h-full w-full object-cover" />}
        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 font-mono text-[9px] text-zinc-100">P{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {named ? (
            <input aria-label={`Name of Picture ${index + 1}`} value={picture.name} onChange={event => onPictureChange({ name: event.target.value })} disabled={disabled} placeholder="Name, e.g. Aki" className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300" title={file.name}>{`<Picture ${index + 1}>`} <span className="text-zinc-500">· {file.name}</span></span>
          )}
          {named && (
            <select aria-label={`Role of Picture ${index + 1}`} value={picture.kind} onChange={event => onPictureChange({ kind: event.target.value as PictureKind })} disabled={disabled} className="rounded-md border border-zinc-800 bg-black/40 px-1.5 py-1 text-xs text-zinc-200">
              <option value="person">Person</option>
              <option value="object">Object</option>
              <option value="setting">Setting</option>
              <option value="style">Style</option>
            </select>
          )}
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove Picture ${index + 1}`} className="px-1 text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40">×</button>
        </div>
        {named && <input aria-label={`Describe Picture ${index + 1}`} value={picture.description} onChange={event => onPictureChange({ description: event.target.value })} disabled={disabled} placeholder="What matters in it, e.g. her navy bandana" className="mt-1.5 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />}
      </div>
    </div>
  );
}

function FrameSlot({ label, file, disabled, onChange }: {
  label: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (file) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {preview && <img src={preview} alt={`${label} preview`} className="aspect-video w-full object-cover" />}
        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-zinc-100">{label}</span>
        <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label={`Remove ${label.toLowerCase()}`} className="absolute right-1 top-1 rounded bg-black/75 px-1.5 text-xs text-zinc-300 hover:text-red-400 disabled:opacity-40">×</button>
      </div>
    );
  }
  return (
    <label className={`flex aspect-video items-center justify-center rounded-lg border border-dashed border-zinc-700 text-center text-xs text-zinc-400 ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-zinc-500 hover:text-zinc-200"}`}>
      {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => { onChange(event.target.files?.[0] ?? null); event.target.value = ""; }} className="sr-only" />
    </label>
  );
}

export function Composer({ busy, inFlight, phase, secondsChoices, canvasAspect, resolutionChoices, canvasResolution, canSetResolution, onGenerate }: Props) {
  const [text, setText] = useState(IDEAS[0].text);
  // The prompt is built from the description and references until the user
  // edits it; then it is theirs, sent as written.
  const [manual, setManual] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("");
  const [pictures, setPictures] = useState<NamedPicture[]>([]);
  const [audios, setAudios] = useState<NamedAudio[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File[]>([]);
  const [seconds, setSeconds] = useState<ClipSeconds>(DEFAULT_CLIP_SECONDS);
  const [aspect, setAspect] = useState<Aspect>(DEFAULT_ASPECT);
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION);
  // An independent clip's opening and ending images (Pika's FL2VA). They
  // never come with reference pictures or audio, so each side locks the other.
  const [firstFrame, setFirstFrame] = useState<File | null>(null);
  const [lastFrame, setLastFrame] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingIdea, setLoadingIdea] = useState<string | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);

  // Once a session exists its lengths replace the default; keep the closest.
  useEffect(() => {
    if (secondsChoices?.length) setSeconds(current => nearestChoice(current, secondsChoices));
  }, [secondsChoices]);

  const frames = frameSet(firstFrame !== null, lastFrame !== null);
  const builtPrompt = frames ? assembleFramePrompt(text, frames, seconds) : assembleBasicPrompt({ text, pictures, audios });
  const prompt = manual ? manualPrompt : builtPrompt;
  // While clips are queued or playing the canvas is fixed, so the pickers
  // show the session's aspect and resolution and the draft carries them unchanged.
  const shownAspect = inFlight && canvasAspect ? canvasAspect as Aspect : aspect;
  const shownResolution = !canSetResolution && canvasResolution ? canvasResolution : resolution;
  const lengthOptions = secondsChoices?.length ? secondsChoices : [...new Set([DEFAULT_CLIP_SECONDS, seconds])].sort((a, b) => a - b);
  const resolutionOptions = resolutionChoices?.length ? resolutionChoices : [DEFAULT_RESOLUTION];
  const draft: SceneDraft = {
    prompt, images, audio, seconds, aspect: shownAspect, resolution: shownResolution,
    firstFrame, lastFrame, continueFromClipId: null, continueMode: "latent",
  };
  const tokens = estimatePromptTokens(draft);
  const hasReferences = images.length > 0 || audio.length > 0;
  // The model takes reference audio only beside a picture or a continuation;
  // this composer starts new scenes, so a picture unlocks it.
  const audioEnabled = images.length > 0;
  const names = pictures.map(picture => picture.name.trim().toLowerCase()).filter(Boolean);
  const duplicateName = names.some((name, index) => names.indexOf(name) !== index);
  const errors = [
    ...validateDraft(draft, secondsChoices),
    ...(!manual && duplicateName ? ["Give each picture a different name so the prompt can tell them apart."] : []),
  ];

  function editPrompt(value: string) {
    setManual(true);
    setManualPrompt(value);
  }

  function backToAutomatic() {
    setManual(false);
  }

  function addPictures(files: FileList | null) {
    const added = Array.from(files ?? []);
    if (!added.length) return;
    setImages(current => [...current, ...added]);
    setPictures(current => [...current, ...added.map(() => ({ name: "", kind: "person" as const, description: "" }))]);
  }

  function removePicture(index: number) {
    setImages(current => current.filter((_, position) => position !== index));
    setPictures(current => current.filter((_, position) => position !== index));
  }

  function addAudio(files: FileList | null) {
    const added = Array.from(files ?? []);
    if (!added.length) return;
    const speaker = pictures.find(picture => picture.kind === "person" && picture.name.trim())?.name ?? "";
    setAudio(current => [...current, ...added]);
    setAudios(current => [...current, ...added.map(() => ({ role: "voice" as const, speaker }))]);
  }

  function removeAudio(index: number) {
    setAudio(current => current.filter((_, position) => position !== index));
    setAudios(current => current.filter((_, position) => position !== index));
  }

  function updatePicture(index: number, change: Partial<NamedPicture>) {
    const previous = pictures[index];
    if (!previous) return;
    setPictures(current => current.map((picture, position) => position === index ? { ...picture, ...change } : picture));
    // A renamed person keeps the voices bound to them.
    if (change.name !== undefined && previous.name) {
      setAudios(current => current.map(item => item.speaker === previous.name ? { ...item, speaker: change.name ?? "" } : item));
    }
  }

  function updateAudio(index: number, change: Partial<NamedAudio>) {
    setAudios(current => current.map((item, position) => position === index ? { ...item, ...change } : item));
  }

  async function selectIdea(idea: SceneIdea) {
    setLoadingIdea(idea.name);
    setExampleError(null);
    try {
      const [pictureFiles, audioFiles] = await Promise.all([
        Promise.all(idea.pictures.map(asset => exampleFile(asset, "image/jpeg"))),
        Promise.all(idea.audios.map(asset => exampleFile(asset, "audio/mpeg"))),
      ]);
      setImages(pictureFiles);
      setAudio(audioFiles);
      setPictures(idea.pictures.map(({ name, kind, description }) => ({ name, kind, description })));
      setAudios(idea.audios.map(({ role, speaker }) => ({ role, speaker })));
      setFirstFrame(null);
      setLastFrame(null);
      setSeconds(secondsChoices?.length ? nearestChoice(idea.seconds, secondsChoices) : idea.seconds);
      setAspect(idea.aspect);
      setText(idea.text);
      setManual(Boolean(idea.prompt));
      setManualPrompt(idea.prompt ?? "");
        setSubmitError(null);
    } catch (error) {
      setExampleError(error instanceof Error ? error.message : "Could not load example references.");
    } finally {
      setLoadingIdea(null);
    }
  }

  async function submit() {
    setSubmitError(null);
    if (errors.length) return;
    try {
      await onGenerate(draft);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not queue clip.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <p className={LABEL}>Try a scene</p>
        <div className="mt-2 grid grid-cols-2 gap-2" aria-busy={loadingIdea !== null}>
          {IDEAS.map(idea => (
            <button
              key={idea.name}
              type="button"
              onClick={() => void selectIdea(idea)}
              disabled={busy || loadingIdea !== null}
              className="group min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left text-zinc-300 transition-colors hover:border-brand/60 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
            >
              {idea.image
                ? <Image src={idea.image} alt="" width={1344} height={768} className="aspect-video w-full object-cover transition-transform group-hover:scale-105" />
                : <span className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 font-mono text-[10px] text-zinc-500">text only</span>}
              <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-[10px] leading-tight" title={idea.name}><span className="truncate">{idea.name}</span><span className="shrink-0 font-mono text-zinc-500">{idea.seconds}s</span></span>
            </button>
          ))}
        </div>
        {loadingIdea && <p className="mt-2 text-[11px] text-zinc-500" role="status">Loading {loadingIdea} references…</p>}
        {exampleError && <p className="mt-2 text-[11px] text-red-400" role="alert">{exampleError}</p>}
      </div>

      <div>
        <label htmlFor="clip-text" className={LABEL}>Describe your clip</label>
        <textarea id="clip-text" rows={6} value={text} disabled={busy || manual} onChange={event => setText(event.target.value)} placeholder="Who is where, what happens, the camera, and what we hear. Use your pictures' names." className={`mt-1.5 resize-y ${FIELD} disabled:opacity-50`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={LABEL}>Pictures <span className="normal-case text-zinc-600">· optional</span></p>
          <span className="font-mono text-[10px] text-zinc-600">{images.length}/{MAX_IMAGES}</span>
        </div>
        {images.map((file, index) => (
          <PictureCard key={`${file.name}-${file.lastModified}-${index}`} file={file} index={index} picture={pictures[index] ?? { name: "", kind: "person", description: "" }} disabled={busy} named={!manual} onPictureChange={change => updatePicture(index, change)} onRemove={() => removePicture(index)} />
        ))}
        {images.length < MAX_IMAGES && (
          <label className={`block rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-center text-xs text-zinc-400 ${frames ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-zinc-500 hover:text-zinc-200"}`}>
            Add reference pictures
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || frames !== null} onChange={event => { addPictures(event.target.files); event.target.value = ""; }} className="sr-only" />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={LABEL}>Audio <span className="normal-case text-zinc-600">· optional</span></p>
          <span className="font-mono text-[10px] text-zinc-600">{audio.length}/{MAX_AUDIO}</span>
        </div>
        {audio.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">A{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300" title={file.name}>{file.name}</span>
              <button type="button" onClick={() => removeAudio(index)} disabled={busy} aria-label={`Remove Audio ${index + 1}`} className="px-1 text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40">×</button>
            </div>
            {!manual && (
              <div className="mt-1.5 flex gap-2">
                <select aria-label={`Role of Audio ${index + 1}`} value={audios[index]?.role ?? "voice"} disabled={busy} onChange={event => updateAudio(index, { role: event.target.value as AudioRole })} className="rounded-md border border-zinc-800 bg-black/40 px-1.5 py-1 text-xs text-zinc-200">
                  <option value="voice">Voice of…</option>
                  <option value="sound">Sound effect</option>
                  <option value="music">Music</option>
                  <option value="soundtrack">Whole soundtrack</option>
                </select>
                {audios[index]?.role === "voice" && (
                  <select aria-label={`Speaker for Audio ${index + 1}`} value={audios[index]?.speaker ?? ""} disabled={busy} onChange={event => updateAudio(index, { speaker: event.target.value })} className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black/40 px-1.5 py-1 text-xs text-zinc-200">
                    <option value="">Choose a person</option>
                    {pictures.filter(picture => picture.kind === "person" && picture.name.trim()).map(picture => <option key={picture.name} value={picture.name}>{picture.name}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
        {audio.length < MAX_AUDIO && (
          <label className={`block rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-center text-xs text-zinc-400 ${audioEnabled ? "cursor-pointer hover:border-zinc-500 hover:text-zinc-200" : "cursor-not-allowed opacity-40"}`}>
            Add audio clips
            <input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/flac,audio/webm" multiple disabled={busy || !audioEnabled || frames !== null} onChange={event => { addAudio(event.target.files); event.target.value = ""; }} className="sr-only" />
          </label>
        )}
        <p className="text-[11px] leading-relaxed text-zinc-500">{audioEnabled ? "2–15 seconds each, 15 seconds together." : "Add a picture first: the model takes audio only beside a picture or a continued clip."}</p>
      </div>

      <div className="space-y-2">
        <p className={LABEL}>First and last frame <span className="normal-case text-zinc-600">· optional</span></p>
        <div className="grid grid-cols-2 gap-2">
          <FrameSlot label="First frame" file={firstFrame} disabled={busy || hasReferences} onChange={setFirstFrame} />
          <FrameSlot label="Last frame" file={lastFrame} disabled={busy || hasReferences} onChange={setLastFrame} />
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {hasReferences
            ? "Remove the reference pictures and audio to pin frames: the model takes one or the other."
            : "Pin where the clip starts, where it ends, or both. Cropped to the canvas; not combined with references."}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="sent-prompt" className={LABEL}>Sent to Pika</label>
          <span className="text-[10px] text-zinc-500">
            {manual
              ? <button type="button" onClick={backToAutomatic} className="text-brand hover:underline">Back to automatic</button>
              : "Built from your description and references"}
          </span>
        </div>
        <textarea id="sent-prompt" rows={manual ? 10 : 6} value={prompt} disabled={busy} onChange={event => editPrompt(event.target.value)} spellCheck={false} className={`mt-1.5 resize-y font-mono text-[11px] ${FIELD} ${manual ? "border-brand/40" : "text-zinc-400"}`} />
        <p className="mt-1 text-[11px] text-zinc-500">{manual
          ? frames ? "Edited by hand: sent exactly as written. Keep the alignment line first: the model does not add it." : "Edited by hand: sent exactly as written. Refer to uploads as <Picture N> and <Audio N>."
          : "Type here to take over the prompt yourself."}</p>
      </div>

      {/* Pinned, so Generate never scrolls out of reach. */}
      <div className="sticky bottom-0 z-10 -mb-4 flex flex-col gap-2 border-t border-zinc-800 bg-zinc-950 pb-4 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <div>
              <label htmlFor="seconds" className={LABEL}>Length</label>
              <select id="seconds" value={seconds} disabled={busy} title={secondsChoices ? undefined : "Start a session to see every length."} onChange={event => setSeconds(Number(event.target.value))} className="mt-1 block rounded-lg border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200">
                {lengthOptions.map(value => <option key={value} value={value}>{value} s</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="resolution" className={LABEL}>Resolution</label>
              <select id="resolution" value={shownResolution} disabled={busy || !canSetResolution} title={!canSetResolution ? "The resolution is fixed while clips are queued or playing." : resolutionChoices ? undefined : "Start a session to choose a resolution."} onChange={event => setResolution(event.target.value)} className="mt-1 block rounded-lg border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50">
                {resolutionOptions.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="aspect" className={LABEL}>Aspect</label>
              <select id="aspect" value={shownAspect} disabled={busy || inFlight} title={inFlight ? "The canvas is fixed while clips are queued or playing." : undefined} onChange={event => setAspect(event.target.value as Aspect)} className="mt-1 block rounded-lg border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50">
                {ASPECTS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <span className={`font-mono text-[10px] ${tokens > PROMPT_TOKEN_BUDGET ? "text-amber-400" : "text-zinc-600"}`} title="Rough estimate; the model counts exactly">~{tokens}/{PROMPT_TOKEN_BUDGET} tokens</span>
        </div>
        {tokens > PROMPT_TOKEN_BUDGET && <p className="text-xs text-amber-400">Likely over the model's {PROMPT_TOKEN_BUDGET}-token budget (reference labels count too). The model refuses an over-budget prompt rather than cutting it.</p>}
        {errors.length > 0 && <ul className="space-y-1 text-xs text-amber-400" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
        {submitError && <p className="text-xs text-red-400" role="alert">{submitError}</p>}
        <button type="button" onClick={() => void submit()} disabled={busy || errors.length > 0} className="rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-40">
          {busy ? phase : inFlight ? "Queue another clip" : "Generate and play"}
        </button>
      </div>
    </div>
  );
}
