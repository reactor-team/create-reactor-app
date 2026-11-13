export type ClipSeconds = number;

/**
 * The lengths come from `state_update.clip_seconds_choices` and are never
 * hardcoded: the model refuses any other value rather than rounding it. Before
 * a session exists the composer offers only this default. A clip builds in
 * about 10 s, so a continued stream keeps up only when each clip plays longer
 * than that; the longest length, 15.083 s, also matches the model's default.
 */
export const DEFAULT_CLIP_SECONDS: ClipSeconds = 15.083;

/** The offered length closest to `seconds`. */
export function nearestChoice(seconds: number, choices: readonly number[]): number {
  if (!choices.length || choices.includes(seconds)) return seconds;
  return choices.reduce((best, value) => Math.abs(value - seconds) < Math.abs(best - seconds) ? value : best);
}

/** The model's default resolution tier; the session lists the others in `resolution_choices`. */
export const DEFAULT_RESOLUTION = "768p";

/**
 * How a clip continues the previous one:
 *   latent: the previous clip's last 2.33 s of picture and sound carry over,
 *           and the clip can have references of its own.
 *   frame:  the clip opens on the previous clip's last frame, prompt only:
 *           no references and no carried sound.
 */
export type ContinueMode = "latent" | "frame";

export const MAX_IMAGES = 9;
export const MAX_AUDIO = 3;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** The aspect ratios `setCanvas` takes. The canvas is fixed while clips are queued or playing. */
export const ASPECTS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "9:21"] as const;
export type Aspect = (typeof ASPECTS)[number];
export const DEFAULT_ASPECT: Aspect = "16:9";

/**
 * The model's text budget: 2048 tokens, counting the labels it adds for each
 * reference. The browser can only estimate (about four characters a token,
 * plus a few tokens a label), so the composer warns and never blocks; the
 * model refuses an over-budget prompt with request_rejected.
 */
export const PROMPT_TOKEN_BUDGET = 2048;
const TOKENS_PER_LABEL = 8;

export function estimatePromptTokens(draft: Pick<SceneDraft, "prompt" | "images" | "audio" | "continueFromClipId" | "firstFrame" | "lastFrame">): number {
  const frames = (draft.firstFrame ? 1 : 0) + (draft.lastFrame ? 1 : 0);
  const labels = draft.images.length + draft.audio.length + frames + (draft.continueFromClipId ? 2 : 0);
  return Math.ceil(draft.prompt.trim().length / 4) + labels * TOKENS_PER_LABEL;
}

export type SceneDraft = {
  prompt: string;
  images: File[];
  audio: File[];
  seconds: ClipSeconds;
  aspect: Aspect;
  resolution: string;
  /** An independent clip's opening and ending images. They never come with references. */
  firstFrame: File | null;
  lastFrame: File | null;
  continueFromClipId: string | null;
  /** Used only with continueFromClipId. */
  continueMode: ContinueMode;
};

/** Whether a draft pins a first or last frame. */
export function hasFrames(draft: Pick<SceneDraft, "firstFrame" | "lastFrame">): boolean {
  return Boolean(draft.firstFrame || draft.lastFrame);
}

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
 * remains the authority on decoded media, prompt tokens, and request budget,
 * and refuses a rule combination with invalid_request.
 *
 * `secondsChoices` is the session's list; pass null before a session exists.
 */
export function validateDraft(draft: SceneDraft, secondsChoices: readonly number[] | null): string[] {
  const errors: string[] = [];
  if (!draft.prompt.trim()) errors.push("Write a prompt for the clip.");
  if (secondsChoices && !secondsChoices.includes(draft.seconds)) {
    errors.push("Choose one of the session's clip lengths.");
  }
  if (draft.images.length > MAX_IMAGES) {
    errors.push(`Choose at most ${MAX_IMAGES} reference images.`);
  }
  if (draft.audio.length > MAX_AUDIO) {
    errors.push(`Choose at most ${MAX_AUDIO} audio references for this clip.`);
  }
  const references = draft.images.length + draft.audio.length;
  const latent = Boolean(draft.continueFromClipId) && draft.continueMode === "latent";
  const frameContinuation = Boolean(draft.continueFromClipId) && draft.continueMode === "frame";
  if (hasFrames(draft) && references) {
    errors.push("First and last frames can't be combined with reference pictures or audio. Remove one or the other.");
  }
  if (hasFrames(draft) && draft.continueFromClipId) {
    errors.push("A clip with a first or last frame is independent: it can't continue another clip.");
  }
  if (frameContinuation && references) {
    errors.push("A frame continuation takes no references: it opens on the previous clip's last frame.");
  }
  if (draft.audio.length && !draft.images.length && !latent) {
    errors.push("Audio references need a picture, or a latent continuation of the previous clip.");
  }
  for (const file of [draft.firstFrame, draft.lastFrame]) {
    if (!file) continue;
    if (file.type && !IMAGE_TYPES.has(file.type)) errors.push(`${file.name}: use a JPEG, PNG, or WebP image.`);
    if (file.size > MAX_FILE_BYTES) errors.push(`${file.name}: images must be at most 25 MiB.`);
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
