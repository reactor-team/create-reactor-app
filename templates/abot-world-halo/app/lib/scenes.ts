// Built-in example worlds: a first frame, the five character views (head,
// left, right, front, back) and the scene. The pictures come from AMAP's ABot
// World Studio gallery, served from Reactor's CDN.
export const REFERENCE_VIEWS = ["Head", "Left", "Right", "Front", "Back"] as const;

const CDN = "https://inc-reactor-static.b-cdn.net/assets/abot-world";

export interface Scene {
  id: string;
  name: string;
  description: string;
  firstFrame: string;
  references: string[];
  prompt: string;
}

function example(id: string, name: string, description: string, prompt: string): Scene {
  return {
    id,
    name,
    description,
    firstFrame: `${CDN}/${id}.jpg`,
    references: REFERENCE_VIEWS.map((view) => `${CDN}/${id}_${view.toLowerCase()}.jpg`),
    prompt,
  };
}

export const SCENES: Scene[] = [
  example(
    "duskfall-hunter",
    "Duskfall Hunter",
    "A monster hunter treks toward a ruined citadel at dusk.",
    "A dark-fantasy wilderness at dusk, seen in third person: a white-haired monster hunter with two swords on his back walks a muddy track through withered moorland. Mist coils through burnt trees and tattered war banners, a rain-swollen stream cuts through the heath, crows circle a gibbet post, and on the horizon a ruined gothic citadel looms against bruised storm clouds and snow-capped peaks. The light is cold and low, the mood grim and foreboding."
  ),
  example(
    "ruins-expedition",
    "Ruins Expedition",
    "A stone-arch valley with waterfalls, deep in painterly ruins.",
    "A lush painterly adventure valley seen in third person: a young hero with golden hair and a teal tunic follows a cobblestone path between crumbling ivy-covered arches and mossy ruins. Ahead, a towering green mountain crowned with waterfalls feeds a turquoise lake, wildflowers crowd the hillsides, and a distant cathedral-like ruin rises above the treeline under bright summer clouds. The light is soft and golden, the mood wondrous and inviting."
  ),
  example(
    "aurora-snowfield",
    "Aurora Snowfield",
    "A photographer under curtains of aurora on a frozen river.",
    "A photorealistic arctic night, seen in third person: a photographer in an orange expedition parka stands on a snow-covered riverbank beside a tripod-mounted camera, watching vast green and magenta aurora curtains ripple across a star-filled sky. A frozen river reflects the lights, a lichen-covered boulder and a wooden signpost flank the scene, and a red fox sits quietly in the snow nearby. The mood is awe-struck, still, and cold."
  ),
  example(
    "desert-riverbed",
    "Desert Riverbed",
    "A traveler follows a cracked riverbed through a canyon.",
    "A photorealistic desert canyon at midday, seen in third person: a lone traveler with a weathered backpack walks a bone-dry riverbed of cracked earth and pale stones. Rust-red mesas and layered rock walls rise on both sides, dry brush and tufts of golden grass cling to the banks, and heat shimmer blurs the far end of the canyon under a deep blue sky with scattered clouds. The light is harsh and bright, the mood desolate and determined."
  ),
];
