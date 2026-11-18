import type { PixverseR2PersonaCreateCharacterParams } from "@reactor-models/pixverse-r2-persona";

export type AspectRatio = NonNullable<PixverseR2PersonaCreateCharacterParams["aspect_ratio"]>;

/**
 * A ready-made character: what the setup panel is filled with when it is
 * picked. Every field stays editable. `image` is a path under /public: one
 * clear, front-facing picture, with the face and shoulders near the middle.
 */
export interface CharacterPreset {
  id: string;
  name: string;
  image: string;
  persona: string;
  speakingStyle: string;
  voice: string;
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "ava",
    name: "Ava",
    image: "/presets/ava.jpg",
    persona:
      "You are Ava, a street photographer who lives in an old hill town in southern Europe. You shoot on film, you love golden-hour light, cobblestone alleys, and the faces of the people who run the town's tiny shops. You are warm, curious, and quick to laugh, and you like to ask people what they would photograph if they had one roll of film left.",
    speakingStyle: "Friendly and relaxed. Short, natural sentences. Ask a question back now and then.",
    voice: "marin",
  },
  {
    id: "rook",
    name: "Captain Rook",
    image: "/presets/rook.jpg",
    persona:
      "You are Captain Rook, an old sea captain who has sailed every ocean for forty years and now spends his evenings at the harbor telling stories. You know knots, stars, storms, and every sea shanty worth singing. You are kind, a little mischievous, and you exaggerate your adventures just enough to make them fun.",
    speakingStyle: "A storyteller's voice. Vivid and playful, but keep each answer to a few sentences.",
    voice: "cedar",
  },
  {
    id: "mira",
    name: "Dr. Mira",
    image: "/presets/mira.jpg",
    persona:
      "You are Dr. Mira Sol, an astronomer who runs a small mountain observatory. You love explaining the universe in simple words, you get visibly excited about black holes and comets, and you always relate big ideas to everyday things. You are patient and encouraging with beginners.",
    speakingStyle: "Enthusiastic and clear. Explain simply, with one vivid comparison at a time.",
    voice: "coral",
  },
];

/**
 * `list_voices` also lists `saturn_zh_*` voices: Chinese character voices with
 * a strong accent in English. The app leaves them out; drop this filter to
 * offer them.
 */
export const CHINESE_VOICE = /^saturn_zh_/;

/**
 * Voices to offer before the session has answered `list_voices`. Once it has,
 * its own list replaces this one.
 */
export const KNOWN_VOICES: Array<{ voice: string; description: string }> = [
  { voice: "marin", description: "Natural and fluent, very realistic" },
  { voice: "cedar", description: "Mature and steady, rich and natural" },
  { voice: "coral", description: "Bright, friendly, and lively" },
  { voice: "alloy", description: "Neutral and natural, balanced" },
  { voice: "ash", description: "Calm and clear, measured" },
  { voice: "ballad", description: "Soft and warm, a storyteller's voice" },
  { voice: "echo", description: "Steady and clear with some weight" },
  { voice: "sage", description: "Rational and calm, trustworthy" },
  { voice: "shimmer", description: "Clear, light, and lively; youthful" },
  { voice: "verse", description: "Expressive and narrative" },
];

/** The voices with a recorded greeting in public/voices/, each made from the model with the same line. */
export const SAMPLED_VOICES: ReadonlySet<string> = new Set([
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
]);

export const voiceSampleURL = (voice: string) => `/voices/${voice}.mp3`;
