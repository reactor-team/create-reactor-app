"use client";

import { useState, type FormEvent } from "react";
import { SendIcon } from "@/app/components/icons";
import { Button, cn, FOCUS_RING, INPUT, Label, Panel } from "@/app/components/ui";
import { SCENE_SECONDS, useDirector } from "@/app/lib/session";

const SECONDS = [5, 6, 8, 10] as const;

/** Step two: once the film is under way, every next shot is typed here. */
export function SceneComposer() {
  const { snapshot, scenes, preset, setup, worldImages, enqueue, newWorld } = useDirector();
  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState<number>(SCENE_SECONDS);
  const [cutTo, setCutTo] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const full = !!snapshot && snapshot.pending_clips >= snapshot.max_pending_clips;
  // The first scene of a run always opens on the world's opening image, so a
  // cut is only offered once a run is under way.
  const runOpen =
    !!snapshot &&
    (snapshot.phase === "starting" || snapshot.phase === "generating" || snapshot.phase === "creating_world") &&
    scenes.length > 0;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!prompt.trim() || sending || full) return;
    setSending(true);
    const queued = await enqueue({ prompt, seconds, cutTo: runOpen ? cutTo : null });
    setSending(false);
    if (queued) {
      setPrompt("");
      setCutTo(null);
    }
  }

  const chip = (active: boolean) =>
    cn(
      "rounded border px-2 py-0.5 text-xs transition",
      active ? "border-brand/60 bg-brand/10 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
      FOCUS_RING,
    );

  return (
    <>
      <Panel
        label="Film"
        action={
          <Button variant="ghost" size="sm" onClick={() => void newWorld()}>
            New film
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          {worldImages[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={worldImages[0].src} alt="" className="h-9 w-14 rounded object-cover ring-1 ring-zinc-700" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{preset?.title ?? "Your film"}</div>
            <div className="truncate font-mono text-[11px] text-zinc-500">
              {setup.style} · {snapshot?.aspect_ratio ?? setup.aspectRatio}
            </div>
          </div>
        </div>
      </Panel>

      <Panel label="Next shot">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <textarea
            aria-label="Next shot"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            autoFocus
            rows={4}
            maxLength={2000}
            placeholder="What happens next? Describe the action and how the view moves."
            className={cn(INPUT, "resize-none leading-relaxed")}
          />

          <div>
            <Label>Length</Label>
            <div className="flex flex-wrap gap-1.5">
              {SECONDS.map((value) => (
                <button key={value} type="button" onClick={() => setSeconds(value)} className={chip(seconds === value)}>
                  {value}s
                </button>
              ))}
            </div>
          </div>

          {worldImages.length > 0 && (
            <div>
              <Label hint={runOpen ? undefined : "Once the first shot is under way"}>Start from</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setCutTo(null)} className={chip(cutTo === null)}>
                  Last shot
                </button>
                {worldImages.map((image, index) => (
                  <button
                    key={image.key}
                    type="button"
                    disabled={!runOpen}
                    title={runOpen ? `Cut to ${image.label}` : "Available once the first shot is under way"}
                    onClick={() => setCutTo(index)}
                    className={cn(
                      "h-8 w-12 overflow-hidden rounded-md ring-1 transition disabled:opacity-30",
                      cutTo === index ? "ring-2 ring-brand" : "ring-zinc-700 hover:ring-zinc-500",
                      FOCUS_RING,
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.src} alt={image.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={!prompt.trim() || sending || full}>
            <SendIcon /> {full ? "Queue is full" : "Add to queue"}
          </Button>
          <p className="text-xs text-zinc-500">
            {full
              ? "Wait for a shot to finish building, or remove one from the reel."
              : "Each shot continues from the last frame of the one before. Enter sends; Shift+Enter adds a line."}
          </p>
        </form>
      </Panel>

    </>
  );
}
