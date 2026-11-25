import type { ReactNode } from "react";
import { cn, PANEL, EYEBROW } from "./ui";

interface PanelProps {
  /** Eyebrow label rendered at the top of the card. */
  label?: string;
  variant?: "card" | "section";
  /** Right-aligned slot in the header row (e.g. a "clear" ghost button). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Shared card or divided sidebar section, with p-3 padding. */
export function Panel({
  label,
  action,
  className,
  children,
  variant = "card",
}: PanelProps) {
  return (
    <div
      className={cn(
        variant === "card" ? PANEL : "border-b border-zinc-800 last:border-b-0",
        "p-3",
        className
      )}
    >
      {(label || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {label ? <span className={EYEBROW}>{label}</span> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
