"use client";

import { useRef, useState } from "react";
import { useXmaxX21 } from "@reactor-models/xmax-x2-1";
import type { DiagnosticReporter } from "@/app/lib/errors";
import { PROMPT_EXAMPLES } from "@/app/lib/examples";
import { Button, Panel, cn, EYEBROW, FOCUS_RING } from "./ui";

// Prompt draft + preset chips + the active-prompt readout. Setting a prompt
// is what arms generation: XmaxX21 starts on its own once a prompt (including an empty string) is
// set and source frames are arriving. Mid-stream re-prompts apply from the
// next generated block. The parent keys this component on the reset nonce,
// so a model reset (generation_stopped) remounts it and clears the draft.
export function Prompt({
  activePrompt,
  referenceReady,
  sourceReady,
  referenceBusy,
  onError,
}: {
  activePrompt: string | null;
  referenceReady: boolean;
  sourceReady: boolean;
  referenceBusy: boolean;
  onError: DiagnosticReporter;
}) {
  const { setPrompt, status } = useXmaxX21();
  const [text, setText] = useState("");
  const [requiresReference, setRequiresReference] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const ready = status === "ready";
  const canApply =
    ready &&
    sourceReady &&
    !referenceBusy &&
    !submitting &&
    (!requiresReference || referenceReady);
  const apply = async () => {
    if (!canApply || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await setPrompt({ prompt: text });
    } catch (error) {
      onError(error, "set_prompt");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const applyPreset = (example: (typeof PROMPT_EXAMPLES)[number]) => {
    setText(example.prompt);
    setRequiresReference(example.requiresReference ?? false);
  };

  return (
    <Panel label="Prompt">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PROMPT_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            title={ex.prompt}
            disabled={!ready}
            onClick={() => applyPreset(ex)}
            className={cn(
              "rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none",
              FOCUS_RING
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Prompt"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setRequiresReference(false);
        }}
        placeholder="Describe the edit, or leave empty for drag-only animation."
        rows={3}
        maxLength={1000}
        className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-brand/60"
      />
      <Button
        variant="primary"
        size="md"
        onClick={() => void apply()}
        disabled={!canApply}
        className="mt-3 min-h-12 w-full text-sm font-semibold"
      >
        {submitting
          ? "Applying…"
          : activePrompt === null
            ? "Start Now"
            : "Apply prompt"}
      </Button>
      {requiresReference && !referenceReady ? (
        <p className="mt-2 text-xs text-zinc-500">
          Choose a reference image before starting this preset.
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          {referenceBusy
            ? "Wait for the reference image to be accepted."
            : !sourceReady
              ? "Connect and choose a source before starting."
              : "Choose a preset or write an edit, then click Start Now. Leave empty for drag-only animation."}
        </p>
      )}
      {activePrompt !== null && (
        <p
          title={activePrompt}
          className={cn(
            EYEBROW,
            "mt-2 line-clamp-2 break-words normal-case tracking-normal text-zinc-500"
          )}
        >
          active:{" "}
          {activePrompt.length
            ? `“${activePrompt}”`
            : "drag-only (empty prompt)"}
        </p>
      )}
    </Panel>
  );
}
