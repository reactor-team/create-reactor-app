import { AVATAR_PRESETS } from "./prompts";

export const MAX_OPENING_IMAGE_BYTES = 30 * 1024 * 1024;

export async function loadPresetImage(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("Could not load the sample image.");
  return new File([await response.blob()], path.split("/").pop()!, {
    type: "image/png",
  });
}

// A copied Next image preview is local to this app. Upload the allowlisted
// original asset, never the optimized thumbnail or an arbitrary local URL.
export function resolveImageUrl(
  value: string,
  origin: string
): { presetPath: string } | { publicUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a public HTTP(S) image URL.");
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    value.trim().length > 2048
  )
    throw new Error("Enter a public HTTP(S) image URL up to 2,048 characters.");
  if (parsed.origin === origin) {
    const original =
      parsed.pathname === "/_next/image"
        ? parsed.searchParams.get("url")
        : parsed.pathname;
    const preset = AVATAR_PRESETS.find((item) => item.image === original);
    if (preset) return { presetPath: preset.image };
    throw new Error(
      "This image is local to the app. Upload the image or choose a preset."
    );
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error(
      "This image URL is private. Upload the image or choose a preset."
    );
  return { publicUrl: parsed.href };
}

export async function validateOpeningImage(
  file: File,
  aspect: "9:16" | "16:9"
) {
  if (file.size === 0 || file.size > MAX_OPENING_IMAGE_BYTES)
    throw new Error("Choose an image between 1 byte and 30 MB.");
  // HEIC may require server-side decoding; don't reject solely because this
  // browser cannot decode it. The service validates the upload in all cases.
  if (/\.heic$/i.test(file.name) || file.type === "image/heic") return;
  const bitmap = await createImageBitmap(file);
  const ratio = bitmap.width / bitmap.height;
  bitmap.close();
  if (
    aspect === "9:16" ? ratio < 0.5 || ratio > 0.667 : ratio < 1.5 || ratio > 2
  )
    throw new Error(
      `Choose a ${aspect === "9:16" ? "portrait" : "landscape"} image matching ${aspect}.`
    );
}
