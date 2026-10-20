import { WORLD_PROMPT } from "./world";

// The two local worlds this app ships, each with the appearance reference and
// prompt it is staged with.
export const LOCAL_WORLDS = [
  {
    id: "courtyard",
    title: "Steampunk plaza",
    blurb: "A brass capsule explores a plaza around a clockwork fountain.",
    reference: "/references/courtyard-steampunk-close-v1.png",
    prompt:
      "Third-person view of a small brass capsule character with two dark eyes exploring a Victorian steampunk plaza. An octagonal copper-and-brass clockwork fountain with turquoise water stands in a circular paved surround. Walnut benches with forged iron fittings and shrub pots flank the fountain. Leafy trees occupy the corner planters, and stone perimeter walls have shallow copper pipes, riveted brass trim and a closed iron-bound wooden gate. Weathered metal paving retains the draft's square grid. Cinematic daylight, warm antique brass and copper, verdigris patina, intricate engraved craftsmanship and tactile aged materials. Match the appearance reference, keep the same capsule character at the draft's position and scale, and follow the scene layout, camera movement, walking and jumps. No new buildings, machines, characters, text or HUD.",
  },
  {
    id: "campground",
    title: "Woodland camp",
    blurb: "A golden capsule explores a woodland camp by a campfire.",
    reference: "/references/campground-painterly-close-v1.png",
    prompt: WORLD_PROMPT,
  },
] as const;
