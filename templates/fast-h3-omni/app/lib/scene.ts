/** The duration choices advertised by FastH3-Omni. */
export const CLIP_SECONDS_CHOICES = [5.875, 8, 10.125, 12.25, 14.375] as const;
export type ClipSeconds = (typeof CLIP_SECONDS_CHOICES)[number];

// Match the webapp's short starter clip; the model's session default is 14.375.
export const DEFAULT_CLIP_SECONDS: ClipSeconds = 8;
export const MAX_IMAGES = 9;
export const MAX_AUDIO = 3;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type SceneDraft = {
  prompt: string;
  images: File[];
  audio: File[];
  seconds: ClipSeconds;
  continueFromClipId: string | null;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/x-opus+ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/webm",
]);

/**
 * Check the browser-side limits before starting a paid generation. The model
 * remains the authority on decoded media, prompt tokens, and request budget.
 */
export function validateDraft(draft: SceneDraft): string[] {
  const errors: string[] = [];
  if (!draft.prompt.trim()) errors.push("Write a prompt for the clip.");
  if (!CLIP_SECONDS_CHOICES.includes(draft.seconds)) {
    errors.push("Choose one of the supported clip lengths.");
  }
  if (draft.images.length > MAX_IMAGES) {
    errors.push(`Choose at most ${MAX_IMAGES} reference images.`);
  }
  const maxAudio = draft.continueFromClipId ? MAX_AUDIO - 1 : MAX_AUDIO;
  if (draft.audio.length > maxAudio) {
    errors.push(`Choose at most ${maxAudio} audio references for this clip.`);
  }
  if (draft.audio.length && !draft.images.length && !draft.continueFromClipId) {
    errors.push("Audio references need an image or a retained clip to continue.");
  }
  for (const file of draft.images) {
    if (file.type && !IMAGE_TYPES.has(file.type)) {
      errors.push(`${file.name}: use a JPEG, PNG, or WebP image.`);
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: images must be at most 25 MiB.`);
    }
  }
  for (const file of draft.audio) {
    if (file.type && !AUDIO_TYPES.has(file.type)) {
      errors.push(`${file.name}: use WAV, MP3, AAC, Ogg, FLAC, or WebM audio.`);
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: audio must be at most 25 MiB.`);
    }
  }
  return errors;
}

/** A suggested text-only scene, editable before the session starts. */
export const STARTER_PROMPT =
  "A small orange robot discovers a glowing flower in a moonlit greenhouse. " +
  "It leans close, and the flower opens in a pulse of warm light. Slow camera " +
  "push-in, crisp cinematic detail, gentle mechanical clicks and airy music.";
