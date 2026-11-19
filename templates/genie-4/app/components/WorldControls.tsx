"use client";
import { Button, Panel } from "./ui";
import { useEffect, useRef, useState } from "react";
import {
  useGenie4,
  useGenie4SessionState,
  type Genie4SessionStateMessage,
  type Genie4SetKeysParams,
} from "@reactor-models/genie-4";
import { SCENES } from "../lib/prompts";
type Key = Genie4SetKeysParams["keys"][number];
const KEYS: Key[] = [
  "w",
  "a",
  "s",
  "d",
  "e",
  " ",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
];
const BUTTONS: [Key, string][] = [
  ["w", "W ↑"],
  ["a", "A ←"],
  ["s", "S ↓"],
  ["d", "D →"],
  ["arrowleft", "Look ←"],
  ["arrowright", "Look →"],
  ["arrowup", "Look ↑"],
  ["arrowdown", "Look ↓"],
  [" ", "Space"],
  ["e", "E"],
];
const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], [data-world-ui], audio, video'
  );

export function WorldControls() {
  const { status, sessionId, getState, setKeys, instruct, endWorld } =
    useGenie4();
  const [snapshot, setSnapshot] = useState<Genie4SessionStateMessage | null>(
    null
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const api = useRef({ getState, setKeys });
  api.current = { getState, setKeys };
  const keyboard = useRef(new Set<Key>());
  const pointers = useRef(new Map<number, Key>());
  const sendQueue = useRef(Promise.resolve());
  const generation = useRef(0);
  const connection = useRef({ status, sessionId });
  connection.current = { status, sessionId };
  useGenie4SessionState((state) => {
    if (status === "ready") setSnapshot(state);
  });
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    if (status === "ready")
      void api.current.getState().then((state) => {
        if (!cancelled && state) setSnapshot(state);
      });
    return () => {
      cancelled = true;
    };
  }, [status, sessionId]);
  const active =
    status === "ready" &&
    (snapshot?.phase === "starting" || snapshot?.phase === "live");

  function sendHeld() {
    const keys = [
      ...new Set([...keyboard.current, ...pointers.current.values()]),
    ];
    const send = api.current.setKeys;
    const epoch = generation.current;
    const ownerSession = sessionId;
    // Preserve order even when a press and release happen in quick succession.
    sendQueue.current = sendQueue.current
      .then(async () => {
        if (
          epoch === generation.current &&
          connection.current.status === "ready" &&
          connection.current.sessionId === ownerSession
        )
          await send({ keys });
      })
      .catch(() => {});
  }
  function releaseAll() {
    keyboard.current.clear();
    pointers.current.clear();
    sendHeld();
  }
  useEffect(() => {
    if (!active) return;
    function down(event: KeyboardEvent) {
      const key = event.key.toLowerCase() as Key;
      if (editable(event.target) || !KEYS.includes(key)) return;
      event.preventDefault();
      if (!keyboard.current.has(key)) {
        keyboard.current.add(key);
        sendHeld();
      }
    }
    function up(event: KeyboardEvent) {
      if (keyboard.current.delete(event.key.toLowerCase() as Key)) {
        event.preventDefault();
        sendHeld();
      }
    }
    function hidden() {
      if (document.hidden) releaseAll();
    }
    function focus(event: FocusEvent) {
      if (editable(event.target)) releaseAll();
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("focusin", focus);
      generation.current += 1;
      releaseAll();
    };
    // Commands are held in refs because generated wrappers change per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sessionId]);

  if (
    status !== "ready" ||
    !snapshot ||
    !["starting", "live", "ending"].includes(snapshot.phase)
  )
    return null;
  async function end() {
    const endingSession = sessionId;
    setBusy(true);
    releaseAll();
    try {
      const reply = await endWorld();
      if (
        reply &&
        connection.current.status === "ready" &&
        connection.current.sessionId === endingSession
      )
        setSnapshot(reply);
    } finally {
      setBusy(false);
    }
  }
  async function changeWorld(instruction: string) {
    if (!instruction.trim() || snapshot?.phase !== "live" || busy) return;
    setBusy(true);
    releaseAll();
    try {
      await instruct({ text: instruction.trim() });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel variant="section" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Explore</p>
          <h2 className="mt-1 text-sm font-medium capitalize" role="status">
            {snapshot.phase}
          </h2>
        </div>
        <span
          className="font-mono text-xs tabular-nums text-zinc-400"
          aria-label="World time remaining"
        >
          {Math.max(
            0,
            Math.ceil(snapshot.max_seconds - snapshot.elapsed_seconds)
          )}
          s
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Hold WASD to move. Arrow keys look around; E and Space perform actions.
        Release to stop.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {BUTTONS.map(([key, label]) => (
          <Button
            variant="secondary"
            size="sm"
            key={key}
            className="touch-none select-none text-xs"
            disabled={!active}
            aria-label={`Hold ${label}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointers.current.set(event.pointerId, key);
              sendHeld();
            }}
            onPointerUp={(event) => {
              if (pointers.current.delete(event.pointerId)) sendHeld();
            }}
            onPointerCancel={(event) => {
              if (pointers.current.delete(event.pointerId)) sendHeld();
            }}
            onLostPointerCapture={(event) => {
              if (pointers.current.delete(event.pointerId)) sendHeld();
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        World keys:{" "}
        {snapshot.keys.map((key) => (key === " " ? "space" : key)).join(", ") ||
          "none"}
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void changeWorld(text);
        }}
      >
        <label className="block text-sm" htmlFor="instruction">
          Change the live world
        </label>
        <input
          id="instruction"
          type="text"
          maxLength={2000}
          placeholder="It starts to snow…"
          value={text}
          disabled={snapshot.phase !== "live" || busy}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={snapshot.phase !== "live" || busy || !text.trim()}
        >
          Send instruction
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {SCENES.map((scene) => (
          <Button
            variant="secondary"
            size="sm"
            key={scene.title}
            title={scene.instruction}
            className="text-xs"
            disabled={snapshot.phase !== "live" || busy}
            onClick={() => {
              setText(scene.instruction);
              void changeWorld(scene.instruction);
            }}
          >
            {scene.title === "Mountain village"
              ? "Let it snow"
              : scene.title === "Neon market"
                ? "A greeting"
                : "Add fireflies"}
          </Button>
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={busy || snapshot.phase === "ending"}
        onClick={() => void end()}
      >
        End world
      </Button>
    </Panel>
  );
}
