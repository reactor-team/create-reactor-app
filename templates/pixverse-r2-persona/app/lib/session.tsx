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
  usePixverseR2Persona,
  usePixverseR2PersonaCharacterAction,
  usePixverseR2PersonaInputDeclined,
  usePixverseR2PersonaQuestionReceived,
  usePixverseR2PersonaSessionState,
  usePixverseR2PersonaTranscript,
} from "@reactor-models/pixverse-r2-persona";
import type {
  PixverseR2PersonaSessionStateMessage,
  PixverseR2PersonaVoicesMessage,
} from "@reactor-models/pixverse-r2-persona";
import { CHARACTER_PRESETS, CHINESE_VOICE, KNOWN_VOICES, type AspectRatio, type CharacterPreset } from "./presets";

// The one place the Persona flow lives.
//
// A session holds one character and at most one call:
//
//   connect → microphone → create_character (or attach) → start_call → talk → end_call
//
// "Call" runs that whole chain. The microphone is asked for when the call
// starts, and published before `start_call`, so the first thing said reaches
// the character. An ended call keeps the character, so calling again with
// the same setup skips creating it.
//
// Everything the UI shows about the model comes from `session_state`, which
// is mirrored here once and cleared when the session is not `ready`.

export type Snapshot = PixverseR2PersonaSessionStateMessage;
export type Phase = Snapshot["phase"];

export interface Portrait {
  key: string;
  src: string;
  file: File | null;
}

export interface CharacterSetup {
  presetID: string | null;
  name: string;
  persona: string;
  speakingStyle: string;
  voice: string;
  aspectRatio: AspectRatio;
  portrait: Portrait | null;
}

export type Entry =
  | { id: string; who: "you"; text: string }
  | { id: string; who: "you-voice" }
  | { id: string; who: "character"; turnID: string; sentences: string[]; action: string | null }
  | { id: string; who: "note"; text: string };

export type Busy = "connecting" | "uploading" | "creating" | "starting" | "ending" | null;
export type MicState = "off" | "on" | "muted" | "blocked";

const CALL_PHASES: ReadonlyArray<Phase> = ["starting", "connecting", "live", "ending"];
const FIRST_SNAPSHOT_TIMEOUT_MS = 20_000;
// Upper bounds for each step of "Call", well above how long each one takes
// when things work, so a stuck step ends with a message instead of a spinner.
const CONNECT_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 45_000;
const CREATE_TIMEOUT_MS = 30_000;
const START_TIMEOUT_MS = 20_000;
// A connected session bills whether or not a call is running.
const IDLE_DISCONNECT_MS = 3 * 60_000;
const LOG_CEILING = 80;

const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

const GREETING = "Hello!";

export function inCall(phase: Phase | null | undefined): boolean {
  return !!phase && CALL_PHASES.includes(phase);
}

interface PersonaValue {
  status: string;
  snapshot: Snapshot | null;
  setup: CharacterSetup;
  preset: CharacterPreset | null;
  voices: Array<{ voice: string; description: string }>;
  busy: Busy;
  log: Entry[];
  mic: MicState;
  muted: boolean;
  /** True when the next call reuses the character already made. */
  sameCharacter: boolean;
  toggleMuted: () => void;
  toggleMic: () => void;
  choosePreset: (id: string) => void;
  choosePortrait: (file: File) => void;
  patchSetup: (patch: Partial<CharacterSetup>) => void;
  call: () => Promise<void>;
  /** Stop a call that is still being set up. */
  cancel: () => void;
  hangUp: () => Promise<void>;
  say: (text: string) => Promise<void>;
}

const PersonaContext = createContext<PersonaValue | null>(null);

export function usePersona(): PersonaValue {
  const value = useContext(PersonaContext);
  if (!value) throw new Error("usePersona used outside PersonaSessionProvider");
  return value;
}

// The app opens blank: the person makes their own character or picks a preset.
const BLANK_SETUP: CharacterSetup = {
  presetID: null,
  name: "",
  persona: "",
  speakingStyle: "",
  voice: KNOWN_VOICES[0].voice,
  aspectRatio: "9:16",
  portrait: null,
};

function setupFromPreset(preset: CharacterPreset): CharacterSetup {
  return {
    presetID: preset.id,
    name: preset.name,
    persona: preset.persona,
    speakingStyle: preset.speakingStyle,
    voice: preset.voice,
    aspectRatio: "9:16",
    portrait: { key: preset.image, src: preset.image, file: null },
  };
}

function characterKey(setup: CharacterSetup): string {
  return JSON.stringify([
    setup.name.trim(),
    setup.persona.trim(),
    setup.speakingStyle.trim(),
    setup.voice,
    setup.aspectRatio,
    setup.portrait?.key ?? "",
  ]);
}

async function portraitFile(portrait: Portrait): Promise<File> {
  if (portrait.file) return portrait.file;
  const response = await fetch(portrait.src);
  if (!response.ok) throw new Error("The portrait did not load.");
  const blob = await response.blob();
  return new File([blob], portrait.src.split("/").pop() ?? "portrait.jpg", { type: blob.type });
}

/** An answer's text from its transcript lines, which can split before punctuation. */
export function answerText(sentences: string[]): string {
  return sentences
    .filter(Boolean)
    .reduce((text, part) => {
      const piece = part.trim();
      if (!text) return piece;
      return /^[.,!?;:…)]/.test(piece) ? text + piece : `${text} ${piece}`;
    }, "");
}

let nextEntryID = 1;
const entryID = () => String(nextEntryID++);

export function PersonaSessionProvider({ children }: { children: ReactNode }) {
  const model = usePixverseR2Persona();
  const { status, lastError } = model;
  const modelRef = useRef(model);
  modelRef.current = model;
  const toast = useToast();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [setup, setSetup] = useState<CharacterSetup>(BLANK_SETUP);
  const [voiceList, setVoiceList] = useState<PixverseR2PersonaVoicesMessage | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [mic, setMic] = useState<MicState>("off");
  const [muted, setMuted] = useState(false);

  const statusRef = useRef(status);
  statusRef.current = status;
  const snapshotRef = useRef<Snapshot | null>(null);
  snapshotRef.current = snapshot;
  const firstSnapshotRef = useRef<(() => void) | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  // Characters made in this visit, by setup, so an unchanged one is attached
  // again instead of being created twice.
  const charactersRef = useRef(new Map<string, string>());

  const phase = status === "ready" ? (snapshot?.phase ?? null) : null;

  // ── The snapshot ─────────────────────────────────────────────────────────

  usePixverseR2PersonaSessionState((next) => {
    setSnapshot(next);
    firstSnapshotRef.current?.();
    firstSnapshotRef.current = null;
  });

  useEffect(() => {
    if (status === "ready") return;
    if (inCall(snapshotRef.current?.phase)) toast("The call was disconnected. Call again to continue.", "info");
    setSnapshot(null);
  }, [status, toast]);

  // A new call starts with an empty conversation.
  const previousPhaseRef = useRef<Phase | null>(null);
  useEffect(() => {
    if (phase === "starting" && previousPhaseRef.current !== "starting") setLog([]);
    previousPhaseRef.current = phase;
  }, [phase]);

  const lastErrorKey = snapshot?.last_error
    ? `${snapshot.last_error.code}:${snapshot.last_error.trace_id ?? snapshot.last_error.reason}`
    : null;
  useEffect(() => {
    const error = snapshotRef.current?.last_error;
    if (!error) return;
    if (error.code === "character_not_found") charactersRef.current.clear();
    toast(error.reason);
  }, [lastErrorKey, toast]);

  // A refused command fails its own call; the SDK reports why on `lastError`
  // and <CommandError/> shows it in the sidebar. Only a failed connect is
  // worth a toast here.
  useEffect(() => {
    if (!lastError || refusalCode(lastError)) return;
    if (lastError.operation === "connect") toast(describeError(lastError));
  }, [lastError, toast]);

  // ── The conversation ─────────────────────────────────────────────────────

  const append = useCallback((entry: Entry) => {
    setLog((current) => [...current, entry].slice(-LOG_CEILING));
  }, []);

  /** Apply a change to the character's answer for `turnID`, creating it if needed. */
  const updateTurn = useCallback(
    (turnID: string, change: (entry: Extract<Entry, { who: "character" }>) => Extract<Entry, { who: "character" }>) => {
      setLog((current) => {
        const index = current.findIndex((entry) => entry.who === "character" && entry.turnID === turnID);
        if (index === -1) {
          const created = change({ id: entryID(), who: "character", turnID, sentences: [], action: null });
          return [...current, created].slice(-LOG_CEILING);
        }
        const next = [...current];
        next[index] = change(current[index] as Extract<Entry, { who: "character" }>);
        return next;
      });
    },
    [],
  );

  usePixverseR2PersonaQuestionReceived((message) => {
    // Typed turns are already in the log; speech has no text to show.
    if (message.prompt_id === null) append({ id: entryID(), who: "you-voice" });
  });

  usePixverseR2PersonaTranscript((line) => {
    const turnID = line.turn_id ?? "untracked";
    updateTurn(turnID, (entry) => {
      const sentences = [...entry.sentences];
      sentences[line.sentence_index] = line.text;
      return { ...entry, sentences };
    });
  });

  usePixverseR2PersonaCharacterAction((message) => {
    if (message.turn_id) updateTurn(message.turn_id, (entry) => ({ ...entry, action: message.text }));
  });

  usePixverseR2PersonaInputDeclined(() =>
    append({ id: entryID(), who: "note", text: "That was declined, so the character changed the subject." }),
  );

  // ── Microphone ───────────────────────────────────────────────────────────

  const releaseMic = useCallback(() => {
    const track = micTrackRef.current;
    micTrackRef.current = null;
    setMic((current) => (current === "blocked" ? current : "off"));
    if (!track) return;
    track.stop();
    if (statusRef.current === "ready") void modelRef.current.unpublish("mic").catch(() => undefined);
  }, []);

  const openMic = useCallback(async () => {
    releaseMic();
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      const [track] = media.getAudioTracks();
      micTrackRef.current = track;
      await modelRef.current.publish("mic", track);
      setMic("on");
    } catch {
      setMic("blocked");
      toast("The microphone is blocked. You can still type to the character.", "info");
    }
  }, [releaseMic, toast]);

  const toggleMic = useCallback(() => {
    const track = micTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setMic(track.enabled ? "on" : "muted");
  }, []);

  // A call that is over no longer needs the microphone.
  const wasInCallRef = useRef(false);
  useEffect(() => {
    const active = inCall(phase);
    if (wasInCallRef.current && !active) releaseMic();
    wasInCallRef.current = active;
  }, [phase, releaseMic]);

  useEffect(() => {
    if (status === "disconnected") releaseMic();
  }, [status, releaseMic]);

  // The character does not speak first: it waits for the caller. Each call
  // opens with a short greeting, sent once the character can hear and its
  // picture is arriving, so it answers with a hello of its own.
  const greetedRef = useRef(false);
  const canGreet = phase === "live" && !!snapshot?.speech_ready && !!snapshot?.video_receiving;
  useEffect(() => {
    if (!inCall(phase)) greetedRef.current = false;
    if (!canGreet || greetedRef.current) return;
    greetedRef.current = true;
    void modelRef.current.say({ text: GREETING }).catch(() => undefined);
  }, [phase, canGreet]);

  useEffect(() => () => releaseMic(), [releaseMic]);

  // ── Setup ────────────────────────────────────────────────────────────────

  const choosePreset = useCallback((id: string) => {
    const preset = CHARACTER_PRESETS.find((entry) => entry.id === id);
    if (preset) setSetup(setupFromPreset(preset));
  }, []);

  const choosePortrait = useCallback((file: File) => {
    setSetup((current) => ({
      ...current,
      presetID: null,
      portrait: {
        key: `upload:${file.name}:${file.size}:${file.lastModified}`,
        src: URL.createObjectURL(file),
        file,
      },
    }));
  }, []);

  const patchSetup = useCallback((patch: Partial<CharacterSetup>) => {
    setSetup((current) => ({ ...current, ...patch }));
  }, []);

  // ── The call ─────────────────────────────────────────────────────────────

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

  // Each press of "Call" is one attempt; Cancel or a timeout ends it, and
  // whatever the abandoned attempt was still awaiting is ignored.
  const attemptRef = useRef(0);

  const abandon = useCallback(async () => {
    attemptRef.current += 1;
    releaseMic();
    setBusy(null);
    // A half-finished setup leaves the session in an unknown state; the next
    // attempt starts from a fresh one.
    await modelRef.current.disconnect().catch(() => undefined);
  }, [releaseMic]);

  const call = useCallback(async () => {
    const plan = setup;
    const portrait = plan.portrait;
    if (!portrait) {
      toast("Add a portrait first.");
      return;
    }
    if (!plan.name.trim() || !plan.persona.trim()) {
      toast("Give the character a name and a persona first.");
      return;
    }
    const attempt = ++attemptRef.current;
    const current = () => attempt === attemptRef.current;
    try {
      setBusy("connecting");
      await withTimeout(connectAndWait(), CONNECT_TIMEOUT_MS, "Could not connect. Try again.");
      if (!current()) return;

      const key = characterKey(plan);
      const saved = charactersRef.current.get(key);
      const reuse = !!saved && snapshotRef.current?.character_id === saved;
      setBusy(reuse || saved ? "creating" : "uploading");
      const [, catalog, image] = await Promise.all([
        openMic(),
        voiceList ? Promise.resolve(undefined) : modelRef.current.listVoices(),
        reuse || saved
          ? Promise.resolve(null)
          : withTimeout(
              portraitFile(portrait).then((file) => modelRef.current.uploadFile(file)),
              UPLOAD_TIMEOUT_MS,
              "The portrait is taking too long to upload. Try again.",
            ),
      ]);
      if (!current()) return;
      if (catalog) setVoiceList(catalog);

      if (!reuse) {
        setBusy("creating");
        const ready = await withTimeout(
          saved
            ? modelRef.current.attachCharacter({ character_id: saved })
            : modelRef.current.createCharacter({
                image: image!,
                name: plan.name.trim(),
                persona: plan.persona.trim(),
                aspect_ratio: plan.aspectRatio,
                ...(plan.voice && { voice: plan.voice }),
                ...(plan.speakingStyle.trim() && { speaking_style: plan.speakingStyle.trim() }),
              }),
          CREATE_TIMEOUT_MS,
          `${plan.name.trim()} is taking too long to get ready. Try again.`,
        );
        if (!current()) return;
        if (!ready) {
          releaseMic();
          return;
        }
        charactersRef.current.set(key, ready.character_id);
      }

      setBusy("starting");
      await withTimeout(modelRef.current.startCall(), START_TIMEOUT_MS, "The call did not start. Try again.");
    } catch (error) {
      if (!current()) return;
      toast(error instanceof Error ? error.message : "The call did not start. Try again.");
      if (error instanceof TimeoutError) await abandon();
      else releaseMic();
    } finally {
      if (current()) setBusy(null);
    }
  }, [setup, voiceList, connectAndWait, openMic, releaseMic, abandon, toast]);

  const cancel = useCallback(() => void abandon(), [abandon]);

  const hangUp = useCallback(async () => {
    setBusy("ending");
    try {
      await modelRef.current.endCall();
    } finally {
      releaseMic();
      setBusy(null);
    }
  }, [releaseMic]);

  const say = useCallback(
    async (text: string) => {
      const line = text.trim();
      if (!line) return;
      append({ id: entryID(), who: "you", text: line });
      await modelRef.current.say({ text: line });
    },
    [append],
  );

  // ── Closing an idle session ──────────────────────────────────────────────

  useEffect(() => {
    if (status !== "ready" || inCall(phase) || busy !== null) return;
    const timer = setTimeout(() => {
      toast("Session closed after three quiet minutes. Call again whenever you like.", "info");
      void modelRef.current.disconnect();
    }, IDLE_DISCONNECT_MS);
    return () => clearTimeout(timer);
  }, [status, phase, busy, toast]);

  // ── What the UI reads ────────────────────────────────────────────────────

  const voices = useMemo(
    () =>
      voiceList?.voices.length
        ? voiceList.voices.filter(({ voice }) => !CHINESE_VOICE.test(voice)).map(({ voice, description }) => ({ voice, description }))
        : KNOWN_VOICES,
    [voiceList],
  );
  const preset = CHARACTER_PRESETS.find((entry) => entry.id === setup.presetID) ?? null;
  const sameCharacter =
    !!snapshot?.character_id && charactersRef.current.get(characterKey(setup)) === snapshot.character_id;
  const toggleMuted = useCallback(() => setMuted((value) => !value), []);
  const live = status === "ready" ? snapshot : null;

  const value = useMemo<PersonaValue>(
    () => ({
      status,
      snapshot: live,
      setup,
      preset,
      voices,
      busy,
      log,
      mic,
      muted,
      sameCharacter,
      toggleMuted,
      toggleMic,
      choosePreset,
      choosePortrait,
      patchSetup,
      call,
      cancel,
      hangUp,
      say,
    }),
    [status, live, setup, preset, voices, busy, log, mic, muted, sameCharacter, toggleMuted, toggleMic, choosePreset, choosePortrait, patchSetup, call, cancel, hangUp, say],
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}
