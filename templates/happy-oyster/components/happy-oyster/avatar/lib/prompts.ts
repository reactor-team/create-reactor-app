// Shared, editable creative presets. No account-specific character IDs.
// Images and exact prompts supplied by the coordinator on October 28.
export interface AvatarPreset {
  key: string;
  name: string;
  style: string;
  image: string;
  resolution: "480p" | "720p";
  aspect_ratio: "9:16" | "16:9";
  prompt: string;
}

export const AVATAR_PRESETS = [
  {
    key: "realistic-cafe",
    name: "Café friend",
    style: "photorealistic",
    image: "/images/cafe-character.png",
    resolution: "480p",
    aspect_ratio: "9:16",
    prompt:
      "Across a café table at dusk sits the fictional adult woman in the opening image, an old friend with short curly dark hair and an olive-green sweater. She speaks in a warm, clear, natural voice with an easy sense of humor. Keep her appearance and the café setting consistent. She looks toward me, smiles, gives a small wave, and says, 'You made it! Tell me about your day.'",
  },
  {
    key: "cartoon-axolotl",
    name: "Axolotl storyteller",
    style: "cartoon",
    image: "/images/cartoon-axolotl.png",
    resolution: "480p",
    aspect_ratio: "9:16",
    prompt:
      "The character is the original friendly pink cartoon axolotl in the opening image, with fluffy external gills, dark expressive eyes, a small smiling mouth, and little hands. Keep the same soft 3D cartoon style and cozy aquatic nook with its low table. The axolotl is a playful storytelling companion, speaking in a cheerful, clear, gentle voice. It looks toward the viewer, gives a small wave, and says, 'Hi! Want to help me make up a tiny adventure?'",
  },
] as const satisfies readonly AvatarPreset[];
