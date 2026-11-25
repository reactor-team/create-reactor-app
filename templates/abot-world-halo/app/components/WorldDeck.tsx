"use client";
import { useEffect, useRef, useState } from "react";
import { useAbotWorldHalo } from "@reactor-models/abot-world-halo";
import { Button, cn } from "./ui";
import {
  ACTION_SECONDS,
  LOOK_KEYS,
  MOVE_KEYS,
  PRESET_ACTIONS,
  isEditable,
  keyName,
  type HeldAction,
  type PresetAction,
} from "../lib/controls";
import { useWorld } from "../lib/world";

type Sent = { forward: number; right: number; yaw: number; pitch: number; action: string; text: string };
const STILL: Sent = { forward: 0, right: 0, yaw: 0, pitch: 0, action: "none", text: "" };

const axis = (held: Set<string>, plus: string, minus: string) =>
  (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);

const WALK: [string, string, string][] = [
  ["w", "W", "Walk forward"],
  ["a", "A", "Step left"],
  ["s", "S", "Walk back"],
  ["d", "D", "Step right"],
];
const LOOK: [string, string, string][] = [
  ["arrowup", "↑", "Look up"],
  ["arrowleft", "←", "Turn left"],
  ["arrowdown", "↓", "Look down"],
  ["arrowright", "→", "Turn right"],
];

/** The controls under the video: Walk and Look held like keys, and the actions. */
export function WorldDeck() {
  const api = useAbotWorldHalo();
  const { status, sessionId } = api;
  const commands = useRef(api);
  commands.current = api;
  const { snapshot } = useWorld();
  const active =
    status === "ready" && (snapshot?.state === "running" || snapshot?.state === "paused");

  const [customText, setCustomText] = useState("");
  const custom = useRef("");
  custom.current = customText.trim();
  const [lit, setLit] = useState<string[]>([]);

  // Every source of input lives in a ref and is read in the same call that
  // changes it, so a quick press and release both reach the model.
  const keys = useRef(new Set<string>());
  const keyActions = useRef<PresetAction[]>([]);
  const pointers = useRef(new Map<number, string>());
  const clicked = useRef<HeldAction | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const sent = useRef<Sent>(STILL);
  const queue = useRef(Promise.resolve());
  const epoch = useRef(0);

  /** Sends only what changed, in order. A held key wins over a clicked action. */
  function flush() {
    const held = new Set([...keys.current, ...pointers.current.values()]);
    let action: string = keyActions.current.at(-1) ?? clicked.current ?? "none";
    if (action === "custom" && !custom.current) action = "none";
    const next: Sent = {
      forward: axis(held, "w", "s"),
      right: axis(held, "d", "a"),
      yaw: axis(held, "arrowright", "arrowleft"),
      pitch: axis(held, "arrowup", "arrowdown"),
      action,
      text: action === "custom" ? custom.current : "",
    };
    setLit(action === "none" ? [...held] : [...held, action]);
    const before = sent.current;
    sent.current = next;
    const owner = epoch.current;
    const world = commands.current;
    queue.current = queue.current
      .then(async () => {
        if (owner !== epoch.current) return;
        if (next.forward !== before.forward || next.right !== before.right)
          await world.setMove({ forward: next.forward, right: next.right });
        if (next.yaw !== before.yaw || next.pitch !== before.pitch)
          await world.setLook({ yaw: next.yaw, pitch: next.pitch });
        if (next.action !== before.action || next.text !== before.text)
          await world.setAction({ name: next.action, text: next.text });
      })
      .catch(() => {});
  }

  /** A click holds an action for ACTION_SECONDS; another click restarts the clock. */
  function trigger(name: HeldAction) {
    if (name === "custom" && !custom.current) return;
    window.clearTimeout(timer.current);
    clicked.current = name;
    flush();
    timer.current = window.setTimeout(() => {
      clicked.current = null;
      flush();
    }, ACTION_SECONDS * 1000);
  }

  function releaseAll() {
    window.clearTimeout(timer.current);
    keys.current.clear();
    keyActions.current = [];
    pointers.current.clear();
    clicked.current = null;
    flush();
  }

  useEffect(() => {
    if (!active) return;
    const actionFor = (key: string) => PRESET_ACTIONS.find((a) => a.key === key)?.name;
    function down(event: KeyboardEvent) {
      if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = keyName(event);
      if (key in MOVE_KEYS || key in LOOK_KEYS) {
        event.preventDefault();
        if (!keys.current.has(key)) {
          keys.current.add(key);
          flush();
        }
        return;
      }
      const action = actionFor(key);
      if (!action) return;
      event.preventDefault();
      if (!keyActions.current.includes(action)) {
        keyActions.current.push(action);
        flush();
      }
    }
    function up(event: KeyboardEvent) {
      const key = keyName(event);
      const action = actionFor(key);
      const hadAction = !!action && keyActions.current.includes(action);
      if (hadAction) keyActions.current = keyActions.current.filter((a) => a !== action);
      if (keys.current.delete(key) || hadAction) flush();
    }
    const hidden = () => document.hidden && releaseAll();
    const focus = (event: FocusEvent) => isEditable(event.target) && releaseAll();
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
      releaseAll();
      epoch.current += 1;
      sent.current = STILL;
    };
    // Commands live in refs because the generated wrappers change per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sessionId]);

  const holdProps = (key: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, key);
      flush();
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (pointers.current.delete(event.pointerId)) flush();
    },
    onPointerCancel: (event: React.PointerEvent) => {
      if (pointers.current.delete(event.pointerId)) flush();
    },
    onLostPointerCapture: (event: React.PointerEvent) => {
      if (pointers.current.delete(event.pointerId)) flush();
    },
  });
  const on = (key: string) => active && lit.includes(key) && "border-brand/70 bg-brand/15 text-brand";

  const cluster = (label: string, caps: [string, string, string][]) => {
    const [top, ...bottom] = caps.map(([key, text, aria]) => (
      <Button
        key={key}
        variant="secondary"
        size="sm"
        aria-label={aria}
        disabled={!active}
        {...holdProps(key)}
        className={cn("w-9 touch-none select-none font-mono", on(key))}
      >
        {text}
      </Button>
    ));
    return (
      <div className="space-y-1.5">
        <p className="eyebrow">{label}</p>
        <div className="grid w-max grid-cols-3 gap-1">
          <span />
          {top}
          <span />
          {bottom}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      {cluster("Walk", WALK)}
      <div className="sm:border-l sm:border-zinc-800 sm:pl-6">{cluster("Look", LOOK)}</div>
      <div className="min-w-[220px] flex-1 space-y-1.5 sm:border-l sm:border-zinc-800 sm:pl-6">
        <p className="eyebrow">Actions</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ACTIONS.map((action) => (
            <Button
              key={action.name}
              variant="secondary"
              size="sm"
              disabled={!active}
              onClick={() => trigger(action.name)}
              className={cn("select-none", on(action.name))}
            >
              {action.label}
              <span className="font-mono text-[10px] text-zinc-500">{action.key}</span>
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            aria-label="Custom action"
            type="text"
            maxLength={1000}
            placeholder="Custom action"
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") trigger("custom");
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!active || !customText.trim()}
            onClick={() => trigger("custom")}
            className={cn("shrink-0 select-none", on("custom"))}
          >
            Trigger
          </Button>
        </div>
      </div>
    </div>
  );
}
