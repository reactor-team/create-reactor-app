"use client";

import {
  Component,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useEdenLive, useReactorClient } from "../lib/model";
import { WORLD_FPS, type LocalWorldId } from "../lib/world";
import { WorldScene } from "./WorldScene";

export type WorldHandle = {
  reset: () => Promise<void>;
  saveFrame: () => Promise<void>;
  press: (key: string) => void;
  release: (key: string) => void;
  captureFrame: () => Promise<Blob>;
};

class SceneBoundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="notice">
        The 3D scene could not start. Try reloading in a browser with WebGL
        enabled.
      </p>
    ) : (
      this.props.children
    );
  }
}

export function ThreeWorld({
  worldId,
  paused,
  apiRef,
  onReady,
  onHeld,
  onError,
}: {
  worldId: LocalWorldId;
  paused: boolean;
  apiRef: RefObject<WorldHandle | null>;
  onReady: (ready: boolean) => void;
  onHeld: (keys: string[]) => void;
  onError: (error: unknown) => void;
}) {
  const { status, sessionId, publish, unpublish } = useEdenLive();
  const reactor = useReactorClient();
  const input = useRef(new Set<string>());
  const surfaceRef = useRef<HTMLCanvasElement | null>(null);
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null);
  const [reset, setReset] = useState(0);
  const callbacks = useRef({ onReady, onHeld, onError });
  callbacks.current = { onReady, onHeld, onError };
  const held = useCallback(
    () => callbacks.current.onHeld([...input.current]),
    []
  );
  const queue = useRef<Promise<void>>(Promise.resolve());
  const onSurface = useCallback((canvas: HTMLCanvasElement | null) => {
    surfaceRef.current = canvas;
    setSurface(canvas);
  }, []);
  const resetPlayer = useCallback(() => {
    input.current.clear();
    held();
    setReset((value) => value + 1);
  }, [held]);
  useEffect(() => {
    input.current.clear();
    held();
  }, [worldId, held]);
  // Download the next rendered frame as a 1280x704 PNG, a starting point for
  // a reference image.
  const saveFrame = useCallback(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const canvas = surfaceRef.current;
    if (!canvas) throw new Error("The scene is still loading.");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("Could not save a frame.")),
        "image/png"
      )
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${worldId}-frame.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [worldId]);
  useImperativeHandle(
    apiRef,
    () => ({
      reset: async () => {
        resetPlayer();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
      },
      saveFrame,
      press: (key) => {
        if (paused) return;
        input.current.add(key);
        held();
      },
      release: (key) => {
        input.current.delete(key);
        held();
      },
      // The frame exactly as it is sent to the model, at 1280x704.
      captureFrame: () =>
        new Promise<Blob>((resolve, reject) => {
          const canvas = surfaceRef.current;
          if (!canvas) return reject(new Error("The scene is still loading."));
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error("Could not capture the scene.")),
            "image/png"
          );
        }),
    }),
    [resetPlayer, saveFrame, held, paused]
  );
  useEffect(() => {
    input.current.clear();
    held();
    if (paused) return;
    const editable = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
        )
      );
    const supported = new Set([
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      "shift",
      " ",
    ]);
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        !supported.has(key) ||
        editable(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      )
        return;
      if (
        key === " " &&
        event.target instanceof Element &&
        event.target.closest("button, a, summary")
      )
        return;
      event.preventDefault();
      input.current.add(key);
      held();
    };
    const up = (event: KeyboardEvent) => {
      input.current.delete(event.key.toLowerCase());
      held();
    };
    const clear = () => {
      input.current.clear();
      held();
    };
    const focus = (event: FocusEvent) => {
      if (editable(event.target)) clear();
    };
    const hidden = () => {
      if (document.hidden) {
        clear();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("focusin", focus);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [paused, held]);
  useEffect(() => {
    callbacks.current.onReady(false);
    if (!surface || status !== "ready") return;
    if (!surface.captureStream) {
      callbacks.current.onError(
        new Error(
          "This browser cannot stream a canvas. Try Chrome or another browser with canvas.captureStream support."
        )
      );
      return;
    }
    let cancelled = false;
    let stream: MediaStream;
    try {
      stream = surface.captureStream(WORLD_FPS);
    } catch (error) {
      callbacks.current.onError(error);
      return;
    }
    const track = stream.getVideoTracks()[0];
    const currentSession = sessionId;
    if (!track) {
      callbacks.current.onError(
        new Error("The scene did not produce a video track.")
      );
      return;
    }
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (
          cancelled ||
          reactor.getStatus() !== "ready" ||
          reactor.getSessionId() !== currentSession
        )
          return;
        await publish("source_video", track);
        if (
          !cancelled &&
          reactor.getStatus() === "ready" &&
          reactor.getSessionId() === currentSession
        )
          callbacks.current.onReady(true);
      })
      .catch((error) => {
        if (!cancelled) callbacks.current.onError(error);
      });
    return () => {
      cancelled = true;
      stream.getTracks().forEach((value) => value.stop());
      callbacks.current.onReady(false);
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (
            reactor.getStatus() === "ready" &&
            reactor.getSessionId() === currentSession
          )
            await unpublish("source_video");
        });
    };
  }, [surface, status, sessionId, publish, unpublish, reactor]);

  return (
    <SceneBoundary key={worldId} onError={onError}>
      <WorldScene
        worldId={worldId}
        input={input}
        paused={paused}
        reset={reset}
        onSurface={onSurface}
        onError={onError}
      />
    </SceneBoundary>
  );
}
