import type { PixverseR2DirectorCreateWorldParams } from "@reactor-models/pixverse-r2-director";

export type Style = NonNullable<PixverseR2DirectorCreateWorldParams["style"]>;
export type AspectRatio = NonNullable<PixverseR2DirectorCreateWorldParams["aspect_ratio"]>;

/**
 * A ready-made world: what the setup panel is filled with when it is picked.
 * Every field stays editable. `images` are paths under /public; the first one
 * is the world's opening image, which the first scene starts from.
 */
export interface WorldPreset {
  id: string;
  title: string;
  description: string;
  style: Style;
  aspectRatio: AspectRatio;
  images: Array<{ src: string; label: string }>;
  /** The scenes queued when the world is created. */
  openingScenes: string[];
}

export const WORLD_PRESETS: WorldPreset[] = [
  {
    id: "night-market",
    title: "Night market",
    description:
      "A rainy neon night market in an old city alley. Paper lanterns sway overhead, steam rises from the food stalls, and a street cook in a red headscarf works a flaming wok while people pass with umbrellas.",
    style: "Dramatic",
    aspectRatio: "16:9",
    images: [
      { src: "/presets/night-market-street.jpg", label: "Alley" },
      { src: "/presets/night-market-cook.jpg", label: "Cook" },
    ],
    openingScenes: [
      "The view drifts slowly down the wet alley toward the cook's stall as lanterns sway in the rain.",
      "The cook tosses noodles high in a burst of orange flame; steam rolls across the counter.",
      "A gust of wind sends the paper lanterns spinning as passers-by lift their umbrellas.",
    ],
  },
  {
    id: "lighthouse",
    title: "Lighthouse",
    description:
      "A white stone lighthouse on a black cliff at stormy dusk. Huge waves crash on the rocks below, the beam sweeps through the rain, and an old keeper in a yellow oilskin coat tends the great brass lamp.",
    style: "Dramatic",
    aspectRatio: "16:9",
    images: [
      { src: "/presets/lighthouse-cliff.jpg", label: "Cliff" },
      { src: "/presets/lighthouse-lamp-room.jpg", label: "Lamp room" },
    ],
    openingScenes: [
      "A massive wave explodes against the cliff as the lighthouse beam sweeps across the storm.",
      "The view rises slowly up the lighthouse tower toward the glowing lamp.",
      "Inside the lamp room, the keeper raises his lantern and checks the turning lens.",
    ],
  },
  {
    id: "sky-islands",
    title: "Sky islands",
    description:
      "Floating grassy islands above a sea of clouds at sunrise. Waterfalls spill off their edges into the mist, rope bridges link ancient stone arches, and a wooden sky ship with patched sails drifts between them.",
    style: "Ambient",
    aspectRatio: "16:9",
    images: [
      { src: "/presets/sky-islands.jpg", label: "Islands" },
      { src: "/presets/sky-islands-airship.jpg", label: "Sky ship" },
    ],
    openingScenes: [
      "The view glides slowly between the floating islands as waterfalls pour into the clouds.",
      "Birds burst from the stone arches and wheel through the golden light.",
      "A wooden sky ship with patched sails emerges from the clouds, propellers turning.",
    ],
  },
];

export const STYLE_OPTIONS: ReadonlyArray<{ value: Style; label: string }> = [
  { value: "Dramatic", label: "Dramatic" },
  { value: "Ambient", label: "Ambient" },
  { value: "POV", label: "POV" },
];

export const ASPECT_OPTIONS: ReadonlyArray<{ value: AspectRatio; label: string }> = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];
