"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CLIP_SECONDS_CHOICES,
  DEFAULT_CLIP_SECONDS,
  MAX_AUDIO,
  MAX_IMAGES,
  validateDraft,
  type ClipSeconds,
  type SceneDraft,
} from "../lib/scene";
import {
  assembleGuidedPrompt,
  type AudioRole,
  type GuidedScene,
  type NamedPicture,
  type PictureKind,
} from "../lib/prompt";

type Props = {
  busy: boolean;
  inFlight: boolean;
  phase: string;
  onGenerate: (draft: SceneDraft) => Promise<void>;
};

type ExampleFile = { src: string; fileName: string };
type SceneIdea = Pick<GuidedScene, "action" | "camera" | "sound" | "music"> & {
  name: string;
  image: string;
  seconds: ClipSeconds;
  pictures: (ExampleFile & NamedPicture)[];
  audios: (ExampleFile & { role: AudioRole; speaker: string })[];
};

const IDEAS: SceneIdea[] = [
  {
    name: "Last train ramen",
    image: "/examples/last-train-ramen.jpg",
    seconds: 5.875,
    action: "At a quiet late-night ramen bar, Aki serves a steaming bowl to Jun, an office worker who has just come in from the rain. Aki says: \"Last bowl tonight. It's yours.\" Jun smiles and replies: \"You just saved my night.\"",
    camera: "Live-action, warm interior, medium two-shot, slow push-in.",
    sound: "Rain on the window, bubbling stock, a ladle against steel, and a bowl set down on wood.",
    music: "",
    pictures: [
      { src: "/examples/last-train-ramen/aki.jpg", name: "Aki", kind: "person", description: "the ramen chef in a navy bandana and white chef's jacket", fileName: "aki.jpg" },
      { src: "/examples/last-train-ramen/jun.jpg", name: "Jun", kind: "person", description: "the office worker in a charcoal-grey coat", fileName: "jun.jpg" },
      { src: "/examples/last-train-ramen/ramen-bar.jpg", name: "Ramen bar", kind: "scene", description: "an empty late-night ramen counter under red paper lanterns", fileName: "ramen-bar.jpg" },
    ],
    audios: [
      { src: "/examples/last-train-ramen/aki.mp3", fileName: "aki.mp3", role: "voice", speaker: "Aki" },
      { src: "/examples/last-train-ramen/jun.mp3", fileName: "jun.mp3", role: "voice", speaker: "Jun" },
    ],
  },
  {
    name: "Lighthouse keeper",
    image: "/examples/lighthouse-keeper.jpg",
    seconds: 5.875,
    action: "In a lighthouse lantern room during a storm, the keeper in a yellow oilskin coat holds a steaming mug, looks toward the camera, and says: \"Same storm as last year, but the tea is better.\"",
    camera: "Cinematic medium close-up, slow push-in, cold blue storm light against a warm lamp.",
    sound: "Rain on glass, distant thunder, and the soft clink of the mug.",
    music: "",
    pictures: [
      { src: "/examples/lighthouse-keeper.jpg", name: "Keeper", kind: "person", description: "the elderly lighthouse keeper in a yellow oilskin coat by the storm-lit window", fileName: "lighthouse-keeper.jpg" },
    ],
    audios: [],
  },
  {
    name: "Morning pour",
    image: "/examples/morning-pour.jpg",
    seconds: 8,
    action: "A small white cup sits beneath a copper espresso machine. Dark espresso pours into it, golden crema rises, and the last drop falls as steam curls past the spout.",
    camera: "Studio product shot, slow orbit, soft rim light.",
    sound: "Pump hum, steam hiss, espresso trickling into ceramic, one soft click.",
    music: "Warm, slow lo-fi beat.",
    pictures: [
      { src: "/examples/morning-pour/espresso-machine.jpg", name: "Espresso machine", kind: "object", description: "brushed steel with walnut handles and a copper top", fileName: "espresso-machine.jpg" },
      { src: "/examples/morning-pour/espresso-cup.jpg", name: "Cup", kind: "object", description: "a small matte-white espresso cup on its saucer", fileName: "espresso-cup.jpg" },
    ],
    audios: [],
  },
];

const INITIAL_SCENE: GuidedScene = {
  action: IDEAS[0].action,
  camera: IDEAS[0].camera,
  sound: IDEAS[0].sound,
  music: IDEAS[0].music,
  pictures: [],
  audios: [],
};

async function exampleFile(asset: ExampleFile, type: string): Promise<File> {
  const response = await fetch(asset.src);
  if (!response.ok) throw new Error(`Could not load ${asset.fileName}.`);
  return new File([await response.blob()], asset.fileName, { type });
}

function PictureCard({ file, index, picture, disabled, guided, onPictureChange, onRemove }: {
  file: File;
  index: number;
  picture: NamedPicture;
  disabled: boolean;
  guided: boolean;
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
    <div className="flex gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-950">
        {preview && <img src={preview} alt={`Picture ${index + 1} preview`} className="h-full w-full object-cover" />}
        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-zinc-100">Picture {index + 1}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-zinc-300" title={file.name}>{picture.name.trim() || `Picture ${index + 1}`} <span className="text-zinc-500">· {file.name}</span></p>
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove Picture ${index + 1}`} className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40">×</button>
        </div>
        {guided && <>
          <div className="mt-2 flex gap-2">
            <input
              aria-label={`Name of Picture ${index + 1}`}
              value={picture.name}
              onChange={event => onPictureChange({ name: event.target.value })}
              disabled={disabled}
              placeholder="Name, e.g. Aki"
              className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
            />
            <select
              aria-label={`Kind of Picture ${index + 1}`}
              value={picture.kind}
              onChange={event => onPictureChange({ kind: event.target.value as PictureKind })}
              disabled={disabled}
              className="rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="person">Person</option>
              <option value="object">Object</option>
              <option value="scene">Scene</option>
            </select>
          </div>
          <input
            aria-label={`Describe Picture ${index + 1}`}
            value={picture.description}
            onChange={event => onPictureChange({ description: event.target.value })}
            disabled={disabled}
            placeholder="Describe the pictured person, object, or scene"
            className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </>}
      </div>
    </div>
  );
}

export function Composer({ busy, inFlight, phase, onGenerate }: Props) {
  const [mode, setMode] = useState<"guided" | "full">("guided");
  const [scene, setScene] = useState<GuidedScene>(INITIAL_SCENE);
  const [fullPrompt, setFullPrompt] = useState(() => assembleGuidedPrompt(INITIAL_SCENE));
  const [fullEdited, setFullEdited] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File[]>([]);
  const [seconds, setSeconds] = useState<ClipSeconds>(DEFAULT_CLIP_SECONDS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingIdea, setLoadingIdea] = useState<string | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const hasSoundtrack = scene.audios.some(item => item.role === "soundtrack");
  const prompt = mode === "guided" ? assembleGuidedPrompt(scene) : fullPrompt;
  const draft: SceneDraft = { prompt, images, audio, seconds, continueFromClipId: null };
  const names = scene.pictures.map(picture => picture.name.trim().toLowerCase()).filter(Boolean);
  const duplicateName = names.some((name, index) => names.indexOf(name) !== index);
  const errors = [
    ...validateDraft(draft),
    ...(mode === "guided" && duplicateName ? ["Give each picture a different name so its prompt reference is unambiguous."] : []),
  ];

  function addPictures(files: FileList | null) {
    const added = Array.from(files ?? []);
    if (!added.length) return;
    setImages(current => [...current, ...added]);
    setScene(current => ({ ...current, pictures: [...current.pictures, ...added.map(() => ({ name: "", kind: "person" as const, description: "" }))] }));
  }

  function addAudio(files: FileList | null) {
    const added = Array.from(files ?? []);
    if (!added.length) return;
    setAudio(current => [...current, ...added]);
    setScene(current => ({
      ...current,
      audios: [...current.audios, ...added.map(() => ({ role: "voice" as const, speaker: current.pictures.find(picture => picture.kind === "person" && picture.name.trim())?.name ?? "" }))],
    }));
  }

  function updatePicture(index: number, change: Partial<NamedPicture>) {
    setScene(current => {
      const previous = current.pictures[index];
      if (!previous) return current;
      const pictures = current.pictures.map((picture, position) => position === index ? { ...picture, ...change } : picture);
      const audios = change.name === undefined || !previous.name
        ? current.audios
        : current.audios.map(audio => audio.speaker === previous.name ? { ...audio, speaker: change.name ?? "" } : audio);
      return { ...current, pictures, audios };
    });
  }

  function updateAudio(index: number, change: { role?: AudioRole; speaker?: string }) {
    setScene(current => ({
      ...current,
      audios: current.audios.map((item, position) => position === index ? { ...item, ...change } : item),
    }));
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
      setSeconds(idea.seconds);
      setScene({
        action: idea.action,
        camera: idea.camera,
        sound: idea.sound,
        music: idea.music,
        pictures: idea.pictures.map(({ name, kind, description }) => ({ name, kind, description })),
        audios: idea.audios.map(({ role, speaker }) => ({ role, speaker })),
      });
      setMode("guided");
      setFullEdited(false);
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
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Try a scene</p>
        <div className="mt-2 grid grid-cols-3 gap-2" aria-busy={loadingIdea !== null}>
          {IDEAS.map(idea => (
            <button
              key={idea.name}
              type="button"
              onClick={() => void selectIdea(idea)}
              disabled={busy || loadingIdea !== null}
              className="group min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left text-zinc-300 transition-colors hover:border-brand/60 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
            >
              <Image src={idea.image} alt="" width={1344} height={768} className="aspect-video w-full object-cover transition-transform group-hover:scale-105" />
              <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-[10px] leading-tight" title={idea.name}><span className="truncate">{idea.name}</span><span className="shrink-0 font-mono text-zinc-500">{idea.seconds}s</span></span>
            </button>
          ))}
        </div>
        {loadingIdea && <p className="mt-2 text-[11px] text-zinc-500" role="status">Loading {loadingIdea} references…</p>}
        {exampleError && <p className="mt-2 text-[11px] text-red-400" role="alert">{exampleError}</p>}
      </div>

      <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/40 p-1" role="tablist" aria-label="Prompt editor">
        {(["guided", "full"] as const).map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => { if (value === "full" && !fullEdited) setFullPrompt(assembleGuidedPrompt(scene)); setMode(value); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs ${mode === value ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {value === "guided" ? "Guided scene" : "Full prompt"}
          </button>
        ))}
      </div>

      {mode === "guided" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="action" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">What happens</label>
            <textarea id="action" rows={5} value={scene.action} disabled={busy} onChange={event => setScene({ ...scene, action: event.target.value })} placeholder="Describe the scene in a sentence or two." className="mt-1.5 w-full resize-y rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
          </div>
          <div>
            <label htmlFor="camera" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Camera and style</label>
            <input id="camera" value={scene.camera} disabled={busy} onChange={event => setScene({ ...scene, camera: event.target.value })} placeholder="Framing, movement, and light" className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
          </div>
          {hasSoundtrack ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500">A complete soundtrack is reused as recorded, so sound and music prompts are omitted.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label htmlFor="sound" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sound</label>
                <input id="sound" value={scene.sound} disabled={busy} onChange={event => setScene({ ...scene, sound: event.target.value })} placeholder="Speech and scene sound" className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              </div>
              <div>
                <label htmlFor="music" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Music <span className="normal-case text-zinc-600">· optional</span></label>
                <input id="music" value={scene.music} disabled={busy} onChange={event => setScene({ ...scene, music: event.target.value })} placeholder="Mood and rhythm" className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="full-prompt" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Full prompt</label>
          <textarea id="full-prompt" rows={9} value={fullPrompt} disabled={busy} onChange={event => { setFullPrompt(event.target.value); setFullEdited(true); }} placeholder="Describe subjects, setting, action, camera, and sound. Refer to uploads as <Picture 1> and <Audio 1>." className="mt-1.5 w-full resize-y rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Pictures <span className="normal-case text-zinc-600">· optional</span></p>
          <span className="font-mono text-[10px] text-zinc-600">{images.length}/{MAX_IMAGES}</span>
        </div>
        {images.map((file, index) => (
          <PictureCard key={`${file.name}-${file.lastModified}-${index}`} file={file} index={index} picture={scene.pictures[index] ?? { name: "", kind: "person", description: "" }} disabled={busy} guided={mode === "guided"} onPictureChange={change => updatePicture(index, change)} onRemove={() => { setImages(current => current.filter((_, position) => position !== index)); setScene(current => ({ ...current, pictures: current.pictures.filter((_, position) => position !== index) })); }} />
        ))}
        <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-center text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
          Add reference pictures
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => { addPictures(event.target.files); event.target.value = ""; }} className="sr-only" />
        </label>
        <p className="text-[11px] leading-relaxed text-zinc-500">Pictures stay in numbered upload order. Use their names in “What happens” to bind people and objects in the prompt.{mode === "full" && " Name each picture in your full prompt."}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Audio references <span className="normal-case text-zinc-600">· optional</span></p>
          <span className="font-mono text-[10px] text-zinc-600">{audio.length}/{MAX_AUDIO}</span>
        </div>
        {audio.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-zinc-300"><span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">Audio {index + 1}</span>{file.name}</span>
              <button type="button" onClick={() => { setAudio(current => current.filter((_, position) => position !== index)); setScene(current => ({ ...current, audios: current.audios.filter((_, position) => position !== index) })); }} disabled={busy} aria-label={`Remove Audio ${index + 1}`} className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40">×</button>
            </div>
            {mode === "guided" && <select aria-label={`Role of Audio ${index + 1}`} value={scene.audios[index]?.role ?? "voice"} disabled={busy} onChange={event => updateAudio(index, { role: event.target.value as AudioRole })} className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200">
              <option value="voice">Voice reference</option>
              <option value="ambience">Ambient sound</option>
              <option value="soundtrack">Complete soundtrack</option>
            </select>}
            {mode === "guided" && scene.audios[index]?.role === "voice" && <>
              <input aria-label={`Speaker for Audio ${index + 1}`} list={`speakers-${index}`} value={scene.audios[index]?.speaker ?? ""} disabled={busy} onChange={event => updateAudio(index, { speaker: event.target.value })} placeholder="Voice of whom? e.g. Aki" className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              <datalist id={`speakers-${index}`}>
                {scene.pictures.filter(picture => picture.kind === "person" && picture.name.trim()).map(picture => <option key={picture.name} value={picture.name} />)}
              </datalist>
            </>}
          </div>
        ))}
        <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-center text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
          Add audio clips
          <input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/flac,audio/webm" multiple disabled={busy} onChange={event => { addAudio(event.target.files); event.target.value = ""; }} className="sr-only" />
        </label>
        <p className="text-[11px] leading-relaxed text-zinc-500">2–15 seconds each. Audio needs a picture or a clip to continue from.{mode === "full" && " Describe each Audio N role in your full prompt."}</p>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-zinc-800 pt-3">
        <div>
          <label htmlFor="seconds" className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Clip length</label>
          <select id="seconds" value={seconds} disabled={busy} onChange={event => setSeconds(Number(event.target.value) as ClipSeconds)} className="mt-1.5 block rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-2 text-xs text-zinc-200">
            {CLIP_SECONDS_CHOICES.map(value => <option key={value} value={value}>{value} seconds</option>)}
          </select>
        </div>
        <span className="text-right font-mono text-[10px] text-zinc-600">{images.length} pictures · {audio.length} audio</span>
      </div>

      {mode === "guided" && <details className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-[11px] text-zinc-500"><summary className="cursor-pointer">View the prompt sent to the model</summary><pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-400">{prompt}</pre></details>}
      {errors.length > 0 && <ul className="space-y-1 text-xs text-amber-400" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      {submitError && <p className="text-xs text-red-400" role="alert">{submitError}</p>}
      <button type="button" onClick={() => void submit()} disabled={busy || errors.length > 0} className="rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-40">
        {busy ? phase : inFlight ? "Queue another clip" : "Generate and play"}
      </button>
    </div>
  );
}
