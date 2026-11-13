import type { SceneDraft } from "./scene";

const MAX_PIXELS = 25_000_000;
const MIN_AUDIO_SECONDS = 2;
const MAX_AUDIO_SECONDS = 15;
const MAX_TOTAL_AUDIO_SECONDS = 15;

/** Check dimensions and duration that a file input cannot express. */
export async function validateMedia(draft: SceneDraft): Promise<string[]> {
  const errors: string[] = [];

  // Frames are centre-cropped to the canvas, so only decoding and size matter.
  for (const file of [draft.firstFrame, draft.lastFrame]) {
    if (!file) continue;
    try {
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > MAX_PIXELS) errors.push(`${file.name}: images may contain at most 25 million pixels.`);
    } catch {
      errors.push(`${file.name}: the browser could not decode this image.`);
    }
  }

  for (const file of draft.images) {
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (width * height > MAX_PIXELS) {
        errors.push(`${file.name}: images may contain at most 25 million pixels.`);
      }
      const aspect = width / height;
      if (aspect < 0.25 || aspect > 4) {
        errors.push(`${file.name}: image aspect must be between 1:4 and 4:1.`);
      }
    } catch {
      errors.push(`${file.name}: the browser could not decode this image.`);
    }
  }

  let totalAudio = 0;
  for (const file of draft.audio) {
    try {
      const duration = await readAudioDuration(file);
      totalAudio += duration;
      if (duration < MIN_AUDIO_SECONDS || duration > MAX_AUDIO_SECONDS) {
        errors.push(`${file.name}: audio must be 2–15 seconds long.`);
      }
    } catch {
      errors.push(`${file.name}: the browser could not read this audio file.`);
    }
  }
  if (totalAudio > MAX_TOTAL_AUDIO_SECONDS) {
    errors.push(`Audio references may run ${MAX_TOTAL_AUDIO_SECONDS} seconds together; these run ${totalAudio.toFixed(1)}.`);
  }

  return errors;
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = new Audio();
    const cleanup = () => {
      element.onloadedmetadata = null;
      element.onerror = null;
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const duration = element.duration;
      cleanup();
      if (Number.isFinite(duration)) resolve(duration);
      else reject(new Error("Invalid duration"));
    };
    element.onerror = () => {
      cleanup();
      reject(new Error("Audio decode failed"));
    };
    element.src = url;
  });
}
