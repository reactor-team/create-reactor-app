"use client";

import { useEffect, useState } from "react";

/** Whole seconds since `key` last changed; 0 while `key` is null. */
export function useElapsed(key: string | null): number {
  const [since, setSince] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSince(Date.now());
    setNow(Date.now());
    if (key === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [key]);

  return key === null ? 0 : Math.floor((now - since) / 1000);
}

/** A wait long enough that the person deserves to see the clock. */
export const SHOW_ELAPSED_AFTER_S = 8;
