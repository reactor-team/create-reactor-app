export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 704;
export const WORLD_FPS = 24;
export type LocalWorldId = "campground" | "courtyard";
export const WORLD_SCENES: Record<
  LocalWorldId,
  {
    spawn: readonly [number, number, number];
    camera: readonly [number, number, number];
  }
> = {
  campground: { spawn: [0, 0.94, 0], camera: [6, 7, 10] },
  courtyard: { spawn: [0, 0.94, 4], camera: [7, 8, 12] },
} as const;
export const WORLD_PROMPT =
  "Third-person view of a small golden capsule character with two dark eyes exploring a woodland campground. A stone-ring campfire glows between two wooden benches, with an open canvas tent nearby. Tall pines, bushes, granite boulders and a timber fence surround the tiled clearing. Richly painterly adventure-game art with opaque gouache and oil brushwork, layered textured color, expressive pine foliage, warm amber sunlight and firelight, forest greens and cool blue-green shadows. Match the appearance reference. Keep the same golden capsule character at the draft's position and scale, and follow the scene layout, camera movement, walking and jumps. No text or HUD.";

export function worldMovement(keys: ReadonlySet<string>) {
  let x =
    Number(keys.has("d") || keys.has("arrowright")) -
    Number(keys.has("a") || keys.has("arrowleft"));
  let z =
    Number(keys.has("w") || keys.has("arrowup")) -
    Number(keys.has("s") || keys.has("arrowdown"));
  const length = Math.hypot(x, z);
  if (length > 0) {
    x /= length;
    z /= length;
  }
  return { x, z, speed: keys.has("shift") ? 7 : 4 };
}
