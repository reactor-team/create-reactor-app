import type { ReactNode } from "react";
import { cn, EYEBROW } from "./ui";

/** The eyebrow above a form field, with an optional hint on the right. */
export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className={EYEBROW}>{children}</span>
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </div>
  );
}

/** The one text-field chrome, for <input>, <textarea> and <select>. */
export const INPUT =
  "w-full rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-brand/60 disabled:opacity-50";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent",
        className
      )}
    />
  );
}

/** A small status chip that floats over the stage. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs backdrop-blur-md",
        tone === "neutral" && "bg-black/60 text-zinc-100",
        tone === "live" && "bg-red-500/90 text-white",
        tone === "error" && "bg-red-950/80 text-red-200 ring-1 ring-red-500/40"
      )}
    >
      {children}
    </span>
  );
}

/** A thin bar that sweeps while something with no known end is in progress. */
export function Shimmer() {
  return (
    <div className="relative h-1 w-48 overflow-hidden rounded-full bg-white/15">
      <div className="animate-shimmer absolute inset-y-0 w-1/3 rounded-full bg-white/80" />
    </div>
  );
}
