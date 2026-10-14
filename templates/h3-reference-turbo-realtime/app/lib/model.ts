"use client";

// Short names for the typed SDK.
//
// @reactor-models/h3-reference-to-video-turbo-realtime is generated from the
// model's published schema, so every symbol carries the model's full name
// (`useH3ReferenceToVideoTurboRealtimeStateUpdate`). Those are the real names;
// this file only shortens them at the import boundary so the components stay
// readable. Nothing here adds behaviour.

export {
  H3ReferenceToVideoTurboRealtimeProvider as H3Provider,
  H3ReferenceToVideoTurboRealtimeMainVideoView as H3MainVideoView,
  useH3ReferenceToVideoTurboRealtime as useH3,
  useH3ReferenceToVideoTurboRealtimeStateUpdate as useH3StateUpdate,
  useH3ReferenceToVideoTurboRealtimeQueueUpdate as useH3QueueUpdate,
  useH3ReferenceToVideoTurboRealtimeClipStarted as useH3ClipStarted,
  useH3ReferenceToVideoTurboRealtimeClipGenerated as useH3ClipGenerated,
  useH3ReferenceToVideoTurboRealtimeClipFinished as useH3ClipFinished,
  useH3ReferenceToVideoTurboRealtimeClipStopped as useH3ClipStopped,
  useH3ReferenceToVideoTurboRealtimeClipFailed as useH3ClipFailed,
} from "@reactor-models/h3-reference-to-video-turbo-realtime";

export type {
  H3ReferenceToVideoTurboRealtimeStateUpdateMessage as H3State,
  H3ReferenceToVideoTurboRealtimeQueueUpdateMessage as H3Queue,
  H3ReferenceToVideoTurboRealtimeEnqueueParams as H3EnqueueParams,
} from "@reactor-models/h3-reference-to-video-turbo-realtime";

/** One entry in a `queue_update` array, and the shape carried by clip messages. */
export type H3Clip = {
  clip_id: string;
  prompt: string;
  metadata: string;
  frames: number;
  seconds: number;
  seed: number;
  ready: boolean;
  has_reference_image?: boolean;
  reference_image_count?: number;
};

/** The aspects `set_canvas` accepts. */
export type H3Aspect = "16:9" | "1:1" | "9:16" | "4:3";

/** The four canvases the model accepts, with the pixels each one produces. */
export const CANVASES: ReadonlyArray<{
  aspect: H3Aspect;
  width: number;
  height: number;
}> = [
  { aspect: "16:9", width: 1344, height: 768 },
  { aspect: "1:1", width: 768, height: 768 },
  { aspect: "9:16", width: 768, height: 1344 },
  { aspect: "4:3", width: 1024, height: 768 },
];

/** Per-clip reference count the model accepts. */
export const MAX_REFERENCES = 9;

// What actually bounds a prompt.
//
// There is no character limit. The prompt is measured in text tokens against
// the engine's budget, and going past it is not a refusal: `enqueue` accepts
// the clip and the build then fails with `clip_failed`. So the composer shows
// an estimate rather than a hard stop, and warns before you spend a build on
// a prompt that cannot fit.
export const PROMPT_TOKEN_BUDGET = 2048;

/**
 * Rough token count for a prompt: about four characters per token for English
 * prose. Deliberately approximate — the real count comes from the model's own
 * tokenizer, which the browser has no access to. Use it to warn, not to block.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.trim().length / 4);
}
