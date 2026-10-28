"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  useXmaxX21,
  type XmaxX21SetPointersParams,
} from "@reactor-models/xmax-x2-1";

type Point = XmaxX21SetPointersParams["frames"][number][number];
type Marker = Point & { left: number; top: number };
const emptyWindow = (): Point[][] => [[], [], [], []];

// Sample gestures on the source video clock, retaining the last four frames.
// Pointer-move frequency does not determine the model's per-frame positions.
export function PointerOverlay({
  outputAspect,
  enabled,
  sourceTrack,
}: {
  outputAspect: number | null;
  enabled: boolean;
  sourceTrack: MediaStreamTrack | null;
}) {
  const { setPointers, status } = useXmaxX21();
  const sendRef = useRef(setPointers);
  sendRef.current = setPointers;
  const rootRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef(new Map<number, Marker>());
  const windowRef = useRef<Point[][]>(emptyWindow());
  const [markers, setMarkers] = useState<[number, Marker][]>([]);
  const active = enabled && status === "ready" && sourceTrack !== null;

  useEffect(() => {
    if (!active || !sourceTrack) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([sourceTrack]);
    let cancelled = false;
    let callbackID: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const sample = () => {
      if (pointsRef.current.size === 0) return;
      const points = [...pointsRef.current.values()].map(({ x, y }) => ({
        x,
        y,
      }));
      windowRef.current = [...windowRef.current.slice(1), points];
      void sendRef.current({ frames: windowRef.current });
    };
    const onFrame = () => {
      if (cancelled) return;
      sample();
      callbackID = video.requestVideoFrameCallback(onFrame);
    };
    if (typeof video.requestVideoFrameCallback === "function") {
      callbackID = video.requestVideoFrameCallback(onFrame);
    } else {
      // Older browsers use the source track's reported cadence.
      const frameRate = sourceTrack.getSettings().frameRate || 24;
      timer = setInterval(sample, 1000 / frameRate);
    }
    void video.play().catch(() => {});
    return () => {
      cancelled = true;
      if (callbackID !== null) video.cancelVideoFrameCallback(callbackID);
      if (timer) clearInterval(timer);
      video.pause();
      video.srcObject = null;
      // The source producer owns the track; do not stop it here.
      if (pointsRef.current.size)
        void sendRef.current({ frames: emptyWindow() });
      pointsRef.current.clear();
      windowRef.current = emptyWindow();
      setMarkers([]);
    };
  }, [active, sourceTrack]);

  function locate(event: PointerEvent<HTMLDivElement>): Marker | null {
    const rectangle = rootRef.current?.getBoundingClientRect();
    if (!rectangle?.width || !rectangle.height) return null;
    let width = rectangle.width;
    let height = rectangle.height;
    let left = 0;
    let top = 0;
    if (outputAspect && outputAspect > 0) {
      if (width / height > outputAspect) {
        width = height * outputAspect;
        left = (rectangle.width - width) / 2;
      } else {
        height = width / outputAspect;
        top = (rectangle.height - height) / 2;
      }
    }
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rectangle.left - left) / width)
    );
    const y = Math.max(
      0,
      Math.min(1, (event.clientY - rectangle.top - top) / height)
    );
    return { x, y, left: left + x * width, top: top + y * height };
  }

  function update(event: PointerEvent<HTMLDivElement>) {
    const point = locate(event);
    if (!point) return;
    pointsRef.current.set(event.pointerId, point);
    setMarkers([...pointsRef.current]);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (!pointsRef.current.delete(event.pointerId)) return;
    setMarkers([...pointsRef.current]);
    if (pointsRef.current.size === 0) {
      windowRef.current = emptyWindow();
      void sendRef.current({ frames: emptyWindow() });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="pointer-overlay"
      aria-label="Drag the edited output with up to eight pointers"
      onPointerDown={(event) => {
        if (!active || pointsRef.current.size >= 8) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (pointsRef.current.has(event.pointerId)) update(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      className={
        "absolute inset-0 touch-none select-none " +
        (active ? "cursor-crosshair" : "pointer-events-none")
      }
    >
      {markers.map(([id, point]) => (
        <span
          key={id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: point.left, top: point.top }}
        >
          <span className="block h-7 w-7 rounded-full border-2 border-white/90 bg-brand/20 shadow-[0_0_16px_2px] shadow-brand/50" />
          <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </span>
      ))}
    </div>
  );
}
