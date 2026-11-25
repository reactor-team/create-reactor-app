// Keyboard map. Movement and look are held keys: each axis is -1, 0 or 1, and
// two opposite keys held together cancel out.
export const MOVE_KEYS = {
  w: "forward",
  s: "back",
  a: "left",
  d: "right",
} as const;
export const LOOK_KEYS = {
  arrowleft: "turnLeft",
  arrowright: "turnRight",
  arrowup: "lookUp",
  arrowdown: "lookDown",
} as const;

// The model has six preset actions (sprint, shield, jump, energy_projectile,
// crouch, repeated_casting) plus `custom`. The sample offers two presets and a
// custom action. A number key holds a preset while it is down; a click on an
// action holds it for ACTION_SECONDS.
export type PresetAction = "jump" | "crouch";
export type HeldAction = PresetAction | "custom";

export const PRESET_ACTIONS: { name: PresetAction; label: string; key: string }[] = [
  { name: "jump", label: "Jump", key: "1" },
  { name: "crouch", label: "Crouch", key: "2" },
];
export const ACTION_SECONDS = 3;

export const ACTION_LABELS: Record<string, string> = {
  none: "No action",
  custom: "Custom",
  sprint: "Sprint",
  shield: "Shield",
  jump: "Jump",
  energy_projectile: "Energy blast",
  crouch: "Crouch",
  repeated_casting: "Cast",
};

/** Normalized key name from a KeyboardEvent ("arrowup", "w", "1"…). */
export function keyName(event: KeyboardEvent) {
  return event.key.toLowerCase();
}

/** Inputs, text areas and other places where typing must not steer the world. */
export function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
  );
}
