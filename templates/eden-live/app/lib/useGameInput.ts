"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createKeySender,
  createLookSender,
  gameKey,
  lookFromMotion,
  type GameKey,
  type Look,
} from "./input";
import { sendCommand, useEdenLive, useReactorClient } from "./model";

// How often locked-pointer motion becomes a held look rate.
const LOOK_SAMPLE_MS = 33;
// With the pointer locked, the left button holds F and the right button holds E.
const MOUSE_KEYS: Record<number, GameKey> = { 0: "f", 2: "e" };

// Keyboard and mouse for the built-in game. Keys are read while the play
// surface has focus; clicking the surface locks the pointer for mouse look.
// Everything held is released on blur, a hidden tab, `enabled` turning
// false, and unmount.
export function useGameInput(
  enabled: boolean,
  onError: (error: unknown) => void
) {
  const { status, setKeys, setLook } = useEdenLive();
  const reactor = useReactorClient();
  const live = useRef({ status, setKeys, setLook });
  live.current = { status, setKeys, setLook };
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const surface = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<GameKey[]>([]);
  const [mouseLook, setMouseLook] = useState(false);

  const { keys, looks } = useMemo(() => {
    const report = (error: unknown) => errorRef.current(error);
    return {
      keys: createKeySender(async (next) => {
        if (live.current.status !== "ready") return;
        await sendCommand(reactor, "set_keys", () =>
          live.current.setKeys({ keys: next })
        );
      }, report),
      looks: createLookSender(async (value) => {
        if (live.current.status !== "ready") return;
        await sendCommand(reactor, "set_look", () =>
          live.current.setLook(value)
        );
      }, report),
    };
  }, [reactor]);

  const press = useCallback(
    (key: GameKey) => {
      void keys.press(key);
      setHeld(keys.held());
    },
    [keys]
  );
  const release = useCallback(
    (key: GameKey) => {
      void keys.release(key);
      setHeld(keys.held());
    },
    [keys]
  );
  const clear = useCallback(async () => {
    setHeld([]);
    await Promise.all([keys.clear(), looks.clear()]);
  }, [keys, looks]);

  // Commands queued for a session that has ended must not reach the next one.
  useEffect(() => {
    if (status === "ready") return;
    keys.reset();
    looks.reset();
    setHeld([]);
  }, [status, keys, looks]);

  useEffect(() => {
    const releaseAll = () => {
      void clear();
      if (document.pointerLockElement === surface.current)
        document.exitPointerLock();
    };
    if (!enabled) releaseAll();
    const visibility = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, clear]);

  useEffect(() => {
    const change = () =>
      setMouseLook(
        surface.current !== null &&
          document.pointerLockElement === surface.current
      );
    document.addEventListener("pointerlockchange", change);
    return () => document.removeEventListener("pointerlockchange", change);
  }, []);

  useEffect(() => {
    if (!mouseLook) return;
    let dx = 0;
    let dy = 0;
    let rate: Look = { yaw: 0, pitch: 0 };
    let last = performance.now();
    const move = (e: MouseEvent) => {
      dx += e.movementX;
      dy += e.movementY;
    };
    const timer = setInterval(() => {
      const now = performance.now();
      rate = lookFromMotion(rate, dx, dy, (now - last) / 1000);
      last = now;
      dx = dy = 0;
      void looks.set(rate.yaw, rate.pitch);
    }, LOOK_SAMPLE_MS);
    const button = (down: boolean) => (e: MouseEvent) => {
      const key = MOUSE_KEYS[e.button];
      if (!key) return;
      e.preventDefault();
      if (down) press(key);
      else release(key);
    };
    const down = button(true);
    const up = button(false);
    document.addEventListener("mousemove", move);
    document.addEventListener("mousedown", down);
    document.addEventListener("mouseup", up);
    return () => {
      clearInterval(timer);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mouseup", up);
      Object.values(MOUSE_KEYS).forEach(release);
      void looks.clear();
    };
  }, [mouseLook, looks, press, release]);

  // Spread on the play surface: the element that takes focus and the pointer.
  const surfaceProps = {
    ref: surface,
    tabIndex: enabled ? 0 : -1,
    onKeyDown: (e: ReactKeyboardEvent) => {
      const key = gameKey(e.key);
      if (!enabled || !key || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      press(key);
    },
    onKeyUp: (e: ReactKeyboardEvent) => {
      const key = gameKey(e.key);
      if (!key) return;
      e.preventDefault();
      release(key);
    },
    onBlur: () => {
      setHeld([]);
      void keys.clear();
    },
    onClick: () => {
      const element = surface.current;
      if (!enabled || !element || document.pointerLockElement === element)
        return;
      element.focus();
      // Browsers refuse a new lock for about a second after Esc; a later click works.
      Promise.resolve(element.requestPointerLock()).catch(() => undefined);
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };

  return { held, mouseLook, press, release, clear, surfaceProps };
}
