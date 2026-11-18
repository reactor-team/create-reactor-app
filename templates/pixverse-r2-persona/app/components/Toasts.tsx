"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./ui";

type Tone = "info" | "error";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

/** Show a short message over the stage. It disappears on its own. */
export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast used outside ToastProvider");
  return push;
}

const LIFETIME_MS = 6_000;
let nextID = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((text: string, tone: Tone = "error") => {
    const id = nextID++;
    setToasts((current) => [...current.filter((toast) => toast.text !== text), { id, text, tone }].slice(-3));
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), LIFETIME_MS);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-xl backdrop-blur-md",
              toast.tone === "error"
                ? "bg-red-950/90 text-red-100 ring-1 ring-red-500/30"
                : "bg-zinc-900/90 text-zinc-100 ring-1 ring-zinc-700",
            )}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
