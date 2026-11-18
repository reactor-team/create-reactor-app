"use client";

import {
  ClipDownloadButton,
  ClipPlayer,
  RecordingError,
  useReactor,
  type Clip,
} from "@reactor-team/js-sdk";
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
import { useToast } from "./Toasts";
import { Button, cn, Spinner } from "./ui";

// Saving works the same for every model with recording on: the SDK asks the
// session for the last N seconds (`requestClip`) or everything so far
// (`requestRecording`). This is the one place the app uses the base
// @reactor-team/js-sdk directly, because the recording surface is not part of
// a model's typed SDK. Saved clips live in memory for this page visit.

interface SavedClip {
  id: number;
  clip: Clip;
  label: string;
  savedAt: Date;
}

interface SavedClipsValue {
  clips: SavedClip[];
  saving: boolean;
  save: (what: number | "session", label?: string) => Promise<void>;
  open: () => void;
}

const SavedClipsContext = createContext<SavedClipsValue | null>(null);

export function useSavedClips(): SavedClipsValue {
  const value = useContext(SavedClipsContext);
  if (!value) throw new Error("useSavedClips used outside SavedClipsProvider");
  return value;
}

let nextID = 1;

export function SavedClipsProvider({ children }: { children: ReactNode }) {
  const { requestClip, requestRecording } = useReactor((s) => ({
    requestClip: s.requestClip,
    requestRecording: s.requestRecording,
  }));
  const toast = useToast();
  const [clips, setClips] = useState<SavedClip[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const save = useCallback(
    async (what: number | "session", label?: string) => {
      setSaving(true);
      try {
        const clip = what === "session" ? await requestRecording() : await requestClip(what);
        setClips((current) => [
          {
            id: nextID++,
            clip,
            label: label ?? (what === "session" ? "Whole session" : `Last ${what} s`),
            savedAt: new Date(),
          },
          ...current,
        ]);
        toast("Saved. Open Saved clips to watch or download it.", "info");
      } catch (error) {
        toast(
          error instanceof RecordingError
            ? `Could not save: ${error.reason}`
            : "Could not save the clip. Try again once something has played.",
        );
      } finally {
        setSaving(false);
      }
    },
    [requestClip, requestRecording, toast],
  );

  const value = useMemo(
    () => ({ clips, saving, save, open: () => setDrawer(true) }),
    [clips, saving, save],
  );

  return (
    <SavedClipsContext.Provider value={value}>
      {children}
      {drawer && <SavedClipsDrawer clips={clips} onClose={() => setDrawer(false)} />}
    </SavedClipsContext.Provider>
  );
}

/** The header button that opens the saved clips. Hidden until there is one. */
export function SavedClipsButton() {
  const { clips, open } = useSavedClips();
  if (clips.length === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={open}>
      Saved clips
      <span className="rounded-full bg-zinc-800 px-1.5 text-[11px] text-zinc-300">
        {clips.length}
      </span>
    </Button>
  );
}

/** A small "Save" control for the stage, with a choice of how much to keep. */
export function SaveMenu({ options }: { options: Array<{ label: string; what: number | "session" }> }) {
  const { save, saving } = useSavedClips();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs text-zinc-100 backdrop-blur-md transition hover:bg-black/80"
      >
        {saving ? <Spinner className="size-3" /> : <SaveIcon />}
        Save
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 w-44 overflow-hidden rounded-lg bg-zinc-900/95 py-1 shadow-xl ring-1 ring-zinc-700 backdrop-blur-md">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setOpen(false);
                void save(option.what, option.label);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedClipsDrawer({ clips, onClose }: { clips: SavedClip[]; onClose: () => void }) {
  const [selected, setSelected] = useState(clips[0]?.id ?? null);
  const current = clips.find((entry) => entry.id === selected) ?? clips[0];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-4xl gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {current && (
            <>
              <ClipPlayer
                key={current.id}
                clip={current.clip}
                muted={false}
                className="aspect-video w-full overflow-hidden rounded-lg bg-black"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{current.label}</span>
                <ClipDownloadButton
                  clip={current.clip}
                  filename={`pixverse-${current.savedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.mp4`}
                  className="!rounded-lg !bg-brand !px-3 !py-1.5 !text-sm !font-medium !text-brand-fg"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex w-48 shrink-0 flex-col gap-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Saved clips
            </span>
            <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-200">
              Close
            </button>
          </div>
          <div className="scrollbar-thin flex flex-col gap-1 overflow-y-auto">
            {clips.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelected(entry.id)}
                className={cn(
                  "rounded-md px-2.5 py-2 text-left text-xs transition",
                  entry.id === current?.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900",
                )}
              >
                <div>{entry.label}</div>
                <div className="text-[10px] text-zinc-500">{entry.savedAt.toLocaleTimeString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
