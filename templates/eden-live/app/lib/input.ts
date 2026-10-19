import type { EdenLiveSetKeysParams } from "@reactor-models/eden-live";
export type GameKey = NonNullable<EdenLiveSetKeysParams["keys"]>[number];
export const GAME_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "f",
  " ",
  "shift",
  "e",
  "r",
  "g",
] as const satisfies readonly GameKey[];

export function isExpectedCancellation(
  message: string,
  explicitlyCancelled: boolean
) {
  return (
    explicitlyCancelled &&
    /invalid state|cancelled|canceled|aborted|\bdisconnected\b/i.test(message)
  );
}
export function gameKey(key: string): GameKey | null {
  const normalized = key.toLowerCase();
  return (GAME_KEYS as readonly string[]).includes(normalized)
    ? (normalized as GameKey)
    : null;
}

// Serialize full held-key snapshots: a delayed press must not overtake release.
export function createKeySender(
  send: (keys: GameKey[]) => Promise<unknown>,
  onError: (error: unknown) => void
) {
  let chain = Promise.resolve();
  let held = new Set<GameKey>();
  let epoch = 0;
  const push = () => {
    const keys = [...held];
    const generation = epoch;
    chain = chain
      .then(() => {
        if (generation === epoch) return send(keys);
      })
      .then(() => undefined)
      .catch(onError);
    return chain;
  };
  return {
    held: () => [...held],
    reset() {
      epoch++;
      held = new Set();
      chain = Promise.resolve();
    },
    press(key: GameKey) {
      if (held.has(key)) return chain;
      held.add(key);
      return push();
    },
    release(key: GameKey) {
      if (!held.delete(key)) return chain;
      return push();
    },
    clear() {
      held = new Set();
      return push();
    },
  };
}
export type Look = { yaw: number; pitch: number };
// Look rates move in 0.05 steps, so a mouse sweep sends a few dozen commands, not hundreds.
const LOOK_STEP = 20;
// Pointer speed, in pixels per second, that holds the fastest look rate.
const LOOK_FULL_SPEED = 1500;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
const quantize = (value: number) =>
  clamp(Math.round(value * LOOK_STEP) / LOOK_STEP) || 0;

// Locked-pointer motion over one sample to a held look rate: moving right
// turns right, moving up tilts up. The rate eases toward the pointer's speed
// and settles at zero soon after the mouse stops.
export function lookFromMotion(
  previous: Look,
  dx: number,
  dy: number,
  seconds: number
): Look {
  const follow = (from: number, delta: number) => {
    const target = clamp(delta / Math.max(seconds, 0.001) / LOOK_FULL_SPEED);
    const next = from + (target - from) / 2;
    return Math.abs(next) < 1 / LOOK_STEP ? 0 : next;
  };
  return { yaw: follow(previous.yaw, dx), pitch: follow(previous.pitch, -dy) };
}

// `set_look` holds a rate until replaced, so only the latest value matters:
// one command in flight, then the newest value if it changed meanwhile.
export function createLookSender(
  send: (look: Look) => Promise<unknown>,
  onError: (error: unknown) => void
) {
  let sent: Look = { yaw: 0, pitch: 0 };
  let wanted = sent;
  let pending: Promise<void> | null = null;
  let epoch = 0;
  const changed = () => wanted.yaw !== sent.yaw || wanted.pitch !== sent.pitch;
  const pump = (): Promise<void> => {
    if (pending) return pending;
    // With nothing to send the loop below would finish synchronously and clear
    // `pending` before it is assigned, leaving a settled promise there forever.
    if (!changed()) return Promise.resolve();
    const generation = epoch;
    pending = (async () => {
      while (generation === epoch && changed()) {
        sent = wanted;
        try {
          await send(sent);
        } catch (error) {
          if (generation === epoch) onError(error);
        }
      }
      if (generation === epoch) pending = null;
    })();
    return pending;
  };
  return {
    reset() {
      epoch++;
      sent = wanted = { yaw: 0, pitch: 0 };
      pending = null;
    },
    set(yaw: number, pitch: number) {
      wanted = { yaw: quantize(yaw), pitch: quantize(pitch) };
      return pump();
    },
    clear() {
      wanted = { yaw: 0, pitch: 0 };
      return pump();
    },
  };
}

export function validateImage(
  file: Pick<File, "size" | "type">,
  width: number,
  height: number
) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size <= 0 || file.size > 25 * 1024 * 1024)
    throw new Error("Image must be non-empty and at most 25 MiB.");
  if (width <= 0 || height <= 0 || width * height > 16_000_000)
    throw new Error("Image must be at most 16 megapixels.");
}
