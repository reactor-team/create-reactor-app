// Editorial starting points; prompts describe places rather than real people.
export const SCENES = [
  {
    id: "mountain-village",
    title: "Mountain village",
    imageUrl: "/images/mountain-village.png",
    prompt:
      "First-person view walking through a quiet cobblestone mountain village at golden hour. Warm light falls on timber houses, flower boxes and distant snowy peaks.",
    instruction: "It starts to snow gently over the village.",
  },
  {
    id: "neon-market",
    title: "Neon market",
    imageUrl: "/images/neon-market.png",
    prompt:
      "First-person view walking through a rainy neon market at night. Lanterns light narrow alleys, steam rises from food stalls and reflections shimmer on the pavement.",
    instruction: "A shopkeeper waves and says welcome to the market.",
  },
  {
    id: "forest-trail",
    title: "Forest trail",
    imageUrl: "/images/forest-trail.png",
    prompt:
      "First-person view on a winding trail through an ancient forest at sunrise. Ferns line the path, tall trees filter soft light and a stream runs beside mossy rocks.",
    instruction: "Fireflies begin to glow among the trees.",
  },
] as const;
