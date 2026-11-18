"use client";

import { useReactor, type ReactorError } from "@reactor-team/js-sdk";
import { useState } from "react";
import { describeError, refusalCode } from "@/app/lib/errors";
import { cn, EYEBROW, FOCUS_RING, PANEL } from "./ui";

// The last command the model refused, read off the SDK's `error` event.
//
// A refusal fails the sender's own call: the typed method resolves
// `undefined` and the store's `lastError` carries `operation: "sendCommand"`
// and the model's `code`. The store keeps the latest error until the next
// one, so this panel stays up until dismissed or until a later error
// replaces it. Connection errors are not refusals and are not shown here.
export function CommandError() {
  const lastError = useReactor((s) => s.lastError);
  const [dismissed, setDismissed] = useState<ReactorError | undefined>();
  const code = refusalCode(lastError);
  if (!lastError || !code || lastError === dismissed) return null;
  // `no_world` only follows a refused create_world, which already said why.
  if (code === "no_world") return null;
  return (
    <div className={cn(PANEL, "border-red-900/50 bg-red-950/20 p-3")} role="alert">
      <div className="flex items-start justify-between gap-2">
        <span className={cn(EYEBROW, "text-red-500")}>
          Command refused · {code}
        </span>
        <button
          type="button"
          aria-label="Dismiss error"
          onClick={() => setDismissed(lastError)}
          className={cn(
            "rounded text-red-400/60 transition hover:text-red-300",
            FOCUS_RING
          )}
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-sm text-red-300">{describeError(lastError)}</p>
    </div>
  );
}
