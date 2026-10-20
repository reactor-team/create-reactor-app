"use client";
import type { CSSProperties } from "react";
import type { GameKey } from "../lib/input";

const LABELS: Partial<Record<GameKey, string>> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "Space",
  shift: "Shift",
};
// Key caps in keyboard positions: [key, grid column, column span], per row.
type Cap = [GameKey, number, number];
const LEFT_HAND: Cap[][] = [
  [
    ["w", 3, 2],
    ["e", 5, 2],
    ["r", 7, 2],
  ],
  [
    ["a", 2, 2],
    ["s", 4, 2],
    ["d", 6, 2],
    ["f", 8, 2],
    ["g", 10, 2],
  ],
  [
    ["shift", 1, 3],
    [" ", 4, 8],
  ],
];
const ARROWS: Cap[][] = [
  [["arrowup", 3, 2]],
  [
    ["arrowleft", 1, 2],
    ["arrowdown", 3, 2],
    ["arrowright", 5, 2],
  ],
];

// A keyboard, and a mouse when the game uses one, that light up what is held.
// Caps also take a pointer press, so the game can be played without a keyboard.
export function ControlMap({
  actions,
  held,
  enabled,
  mouse,
  mouseLook,
  idle,
  hint,
  onPress,
  onRelease,
}: {
  actions: Partial<Record<GameKey, string>>;
  held: readonly string[];
  enabled: boolean;
  mouse: boolean;
  mouseLook: boolean;
  idle: string;
  hint: string;
  onPress: (key: GameKey) => void;
  onRelease: (key: GameKey) => void;
}) {
  const cap = ([key, column, span]: Cap) => (
    <button
      key={key}
      className={[
        "cap",
        held.includes(key) && "held",
        !actions[key] && "unused",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ gridColumn: `${column} / span ${span}` }}
      disabled={!enabled}
      aria-label={`Hold ${LABELS[key] ?? key.toUpperCase()}${actions[key] ? `: ${actions[key]}` : ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(key);
      }}
      onPointerUp={() => onRelease(key)}
      onPointerCancel={() => onRelease(key)}
      onLostPointerCapture={() => onRelease(key)}
    >
      <b>{LABELS[key] ?? key.toUpperCase()}</b>
      <small>{actions[key] ?? ""}</small>
    </button>
  );
  const cluster = (rows: Cap[][], columns: number) => (
    <div className="caps" style={{ "--columns": columns } as CSSProperties}>
      {rows.flat().map(cap)}
    </div>
  );
  const button = (key: GameKey, side: string) => (
    <div
      className={[
        "mouse-button",
        held.includes(key) && "held",
        !actions[key] && "unused",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <b>{side}</b>
      <small>
        {actions[key] ? `${key.toUpperCase()} · ${actions[key]}` : ""}
      </small>
    </div>
  );
  return (
    <section className="panel controls" aria-label="Game controls">
      <div className="panel-head">
        <h2>Controls</h2>
        <span className="hint">
          {held.length
            ? held
                .map((key) => LABELS[key as GameKey] ?? key.toUpperCase())
                .join(" + ")
            : idle}
        </span>
      </div>
      <div className="control-map">
        {cluster(LEFT_HAND, 12)}
        {cluster(ARROWS, 6)}
        {mouse && (
          <div className={`mouse ${mouseLook ? "on" : ""}`}>
            {button("f", "Left")}
            {button("e", "Right")}
            <span>
              {mouseLook ? "Move to look · Esc" : "Click world to look"}
            </span>
          </div>
        )}
      </div>
      <p className="hint">{hint}</p>
    </section>
  );
}
