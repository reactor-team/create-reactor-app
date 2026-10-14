"use client";

import type { FileRef } from "@reactor-team/js-sdk";
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
import { useCommand } from "./command";
import { useH3, useH3ClipGenerated } from "./model";
import { loadPresetFile, PRESETS } from "./presets";
import {
  buildPrompt,
  draftProblem,
  slotsForMode,
  type Mode,
  type ShotDraft,
  type Slot,
} from "./shot";

// One place for the state the composer, the stage and the steer box share.
//
// Every clip here is one somebody asked for. The session generates nothing on
// its own: it opens with the shot in the composer, and continues only when the
// next beat is typed. Playback runs dry between clips, and that is the honest
// behaviour — a clip takes as long as it takes to build.
//
// Continuing rather than cutting is the one subtlety. A steer carries the
// references and their descriptions over and chains from the most recently
// generated clip, so motion, camera and audio hold across the boundary.

interface SessionValue {
  draft: ShotDraft;
  setMode: (mode: Mode) => void;
  setSlotFile: (index: number, file: File | null) => void;
  setSlotDescription: (index: number, description: string) => void;
  addSlot: () => void;
  removeSlot: (index: number) => void;
  patchDraft: (patch: Partial<ShotDraft>) => void;
  problem: string | null;
  /** Queue the draft as the opening shot and start the session. */
  queueShot: () => Promise<void>;
  /** Queue the next beat, continuing from the latest generated clip. */
  steer: (action: string) => Promise<void>;
  /** True while this mode can continue a scene at all (free mode is one-shot). */
  canContinue: boolean;
  busy: boolean;
  phase: "idle" | "connecting" | "uploading" | "queueing";
  hasQueued: boolean;
  lastAccepted: { clipId: string; seconds: number; seed: number } | null;
  loadingPreset: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession used outside SessionProvider");
  return value;
}

const EMPTY_DRAFT = (mode: Mode): ShotDraft => ({
  mode,
  slots: slotsForMode(mode),
  action: "",
  sound: "",
  seconds: 10,
  seed: "",
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const { status, connect, uploadFile, enqueue, setAutoplay } = useH3();
  const { run } = useCommand();

  const [draft, setDraft] = useState<ShotDraft>(() =>
    EMPTY_DRAFT("one-subject"),
  );
  const [phase, setPhase] = useState<SessionValue["phase"]>("idle");
  const [hasQueued, setHasQueued] = useState(false);
  const [lastAccepted, setLastAccepted] =
    useState<SessionValue["lastAccepted"]>(null);
  const [uploaded, setUploaded] = useState<Map<number, FileRef>>(new Map());
  const [loadingPreset, setLoadingPreset] = useState(true);

  // Refs, not state: these are read inside callbacks that must not re-run just
  // because a queue count moved.
  const lastGenerated = useRef<string | null>(null);
  const inFlight = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // What a continuation chains from. Only a *generated* clip can be continued,
  // so this tracks clip_generated rather than the enqueue reply.
  useH3ClipGenerated((m) => {
    lastGenerated.current = m.clip.clip_id;
  });

  const canContinue = draft.mode !== "free";

  /* ---------------------------------------------------------------- */
  /* Presets                                                           */
  /* ---------------------------------------------------------------- */

  const presetToken = useRef(0);
  const loadPreset = useCallback(async (mode: Mode) => {
    const token = ++presetToken.current;
    const preset = PRESETS[mode];
    setLoadingPreset(true);
    setUploaded(new Map());
    try {
      const files = await Promise.all(
        preset.slots.map((slot) => loadPresetFile(slot.src)),
      );
      if (token !== presetToken.current) return;
      setDraft({
        mode,
        slots: preset.slots.map((slot, i) => ({
          index: i + 1,
          role:
            i === preset.slots.length - 1 && mode === "two-subjects"
              ? ("place" as const)
              : ("subject" as const),
          hint:
            mode === "two-subjects"
              ? ["First subject", "Second subject", "The place"][i]
              : mode === "one-subject"
                ? "The subject"
                : "Reference",
          description: slot.description,
          file: files[i],
        })),
        action: preset.action,
        sound: preset.sound,
        seconds: preset.seconds,
        seed: "",
      });
    } catch {
      if (token === presetToken.current) setDraft(EMPTY_DRAFT(mode));
    } finally {
      if (token === presetToken.current) setLoadingPreset(false);
    }
  }, []);

  useEffect(() => {
    void loadPreset("one-subject");
  }, [loadPreset]);

  const setMode = useCallback(
    (mode: Mode) => {
      setDraft(EMPTY_DRAFT(mode));
      setUploaded(new Map());
      lastGenerated.current = null;
      setHasQueued(false);
      void loadPreset(mode);
    },
    [loadPreset],
  );

  /* ---------------------------------------------------------------- */
  /* Draft edits                                                       */
  /* ---------------------------------------------------------------- */

  const patchDraft = useCallback((patch: Partial<ShotDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const setSlotFile = useCallback((index: number, file: File | null) => {
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((s) => (s.index === index ? { ...s, file } : s)),
    }));
    setUploaded((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const setSlotDescription = useCallback(
    (index: number, description: string) => {
      setDraft((d) => ({
        ...d,
        slots: d.slots.map((s) =>
          s.index === index ? { ...s, description } : s,
        ),
      }));
    },
    [],
  );

  const addSlot = useCallback(() => {
    setDraft((d) => {
      if (d.slots.length >= 9) return d;
      return {
        ...d,
        slots: [
          ...d.slots,
          {
            index: d.slots.length + 1,
            role: "subject" as const,
            hint: "Reference",
            description: "",
            file: null,
          },
        ],
      };
    });
  }, []);

  const removeSlot = useCallback((index: number) => {
    setDraft((d) => {
      if (d.slots.length <= 1) return d;
      const slots = d.slots
        .filter((s) => s.index !== index)
        .map((s, i) => ({ ...s, index: i + 1 }));
      return { ...d, slots };
    });
    setUploaded(new Map());
  }, []);

  /* ---------------------------------------------------------------- */
  /* Sending                                                           */
  /* ---------------------------------------------------------------- */

  // Connect, turn autoplay on, and hand back the references in slot order.
  // Sequential, because slot order is what binds Picture N.
  const prepare = useCallback(async (): Promise<FileRef[]> => {
    if (status !== "ready") {
      setPhase("connecting");
      await connect();
      await run("set_autoplay", () => setAutoplay({ enabled: true }));
    }
    setPhase("uploading");
    const refs: FileRef[] = [];
    const next = new Map(uploaded);
    for (const slot of draftRef.current.slots) {
      if (!slot.file) continue;
      const held = next.get(slot.index);
      if (held) {
        refs.push(held);
        continue;
      }
      const ref = await uploadFile(slot.file);
      next.set(slot.index, ref);
      refs.push(ref);
    }
    setUploaded(next);
    return refs;
  }, [connect, run, setAutoplay, status, uploadFile, uploaded]);

  const send = useCallback(
    async (
      prompt: string,
      refs: FileRef[],
      opts: { continueFrom?: string } = {},
    ) => {
      const d = draftRef.current;
      const outcome = await run("enqueue", () =>
        enqueue({
          prompt,
          seconds: d.seconds,
          ...(refs.length === 1
            ? { reference_image: refs[0] }
            : { reference_images: refs }),
          ...(d.seed.trim() ? { seed: Number(d.seed) } : {}),
          ...(opts.continueFrom
            ? { continue_from_clip_id: opts.continueFrom }
            : {}),
        }),
      );
      // A refusal comes back on this call, with the model's code and reason;
      // `run()` hands it to <CommandError />.
      if (!outcome.ok || !outcome.reply) return null;
      const reply = outcome.reply;
      setHasQueued(true);
      setLastAccepted({
        clipId: reply.clip.clip_id,
        seconds: reply.clip.seconds,
        seed: reply.clip.seed,
      });
      return reply.clip.clip_id;
    },
    [enqueue, run],
  );

  // The opening shot, and "play this scene" again once the session is running.
  //
  // Pressing it a second time is a deliberate cut, not a continuation: no
  // `continue_from_clip_id`, because the reason to press it again is that the
  // composer changed.
  const queueShot = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const refs = await prepare();
      setPhase("queueing");
      await send(buildPrompt(draftRef.current), refs);
    } finally {
      setPhase("idle");
      inFlight.current = false;
    }
  }, [prepare, send]);

  // The next beat of the same scene. The references and their descriptions
  // carry over, so only the action changes, and it chains from the latest
  // generated clip so motion, camera and audio hold across the boundary.
  const steer = useCallback(
    async (action: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const refs = await prepare();
        setPhase("queueing");
        await send(
          buildPrompt({ ...draftRef.current, action }, { continuing: true }),
          refs,
          { continueFrom: lastGenerated.current ?? undefined },
        );
        // Carry it forward so a later beat continues from this one.
        setDraft((d) => ({ ...d, action }));
      } finally {
        setPhase("idle");
        inFlight.current = false;
      }
    },
    [prepare, send],
  );

  const value = useMemo<SessionValue>(
    () => ({
      draft,
      setMode,
      setSlotFile,
      setSlotDescription,
      addSlot,
      removeSlot,
      patchDraft,
      problem: draftProblem(draft),
      queueShot,
      steer,
      canContinue,
      busy: phase !== "idle" || loadingPreset,
      phase,
      hasQueued,
      lastAccepted,
      loadingPreset,
    }),
    [
      addSlot,
      canContinue,
      draft,
      hasQueued,
      lastAccepted,
      loadingPreset,
      patchDraft,
      phase,
      queueShot,
      removeSlot,
      setMode,
      setSlotDescription,
      setSlotFile,
      steer,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export type { Slot };
