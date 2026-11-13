// The live director's writer prompt: what it is told, what it is sent, and
// what comes back. Pure functions, shared by the server route and the tests;
// the provider call itself lives in llm.ts, server side.

import type { ContinueMode } from "./scene";

/** One request to write the next clip. */
export type DirectorRequest = {
  /** The opening scene's prompt, exactly as it was sent. */
  scene: string;
  /** The last few clips' prompts, oldest first. */
  recent: string[];
  /** The viewer's direction; empty to let the scene carry on. */
  direction: string;
  seconds: number;
  mode: ContinueMode;
  /** Reference audio clips the scene uploaded (a latent continuation numbers its carried sound after these). */
  audios: number;
};

/** The most recent prompts the writer sees; older ones fall out. */
export const RECENT_CLIPS = 3;
const MAX_WRITTEN_TOKENS = 1500;

const RULES = `How Pika H3 Flex reads a prompt (from Pika's prompt guidance):
- It makes the clip's picture and sound together and uses the prompt exactly as written; nothing is added or rewritten. Write the scene description in English; keep dialogue and on-screen text in their own language.
- Write the scene in the order it plays: first the look (light, colour, lens, grain) and who is where, then what happens and how it ends, then the camera and the sound. State the final visible result of each action and the number of people present.
- A clip is one continuous shot or several shots joined by hard cuts. Start with "[Shot 1]". Start each later shot with its cut time, in order and within the clip length: "[Shot 2] At 00:04.000, cut to …". Cut only for new information; for a small change of distance or angle, move the camera instead. For a single take write "one continuous shot"; for a fixed view, "The camera remains fixed."
- Describe camera moves as plain sentences with their size, speed, start and end: push in, pull out, pan, truck, tilt, orbit, track, hold.
- Give each speaker a stable ID such as (S1), and put spoken words in a dialogue tag with their language, describing the voice outside it: She says softly (S1), <d>[English] It works again.</d> Put wanted on-screen text in double quotes, in its original language.
- Describe sounds where they happen. End with two summary lines: "Sound: …" (ambience, physical and non-verbal sounds, not the dialogue) and "Music: …" (the score only the viewer hears, or "none").
- Add "Everything moves at normal real-time speed, with no slow motion." near the end. Add other fixes only when the scene needs them.
- Every line counts toward a 2,048-token budget. Keep it under 220 words. Output only the prompt: no title, no preamble, no quotes around it, no markdown.`;

/** The system prompt. Fixed, so a provider's prompt cache can hold it. */
export const DIRECTOR_SYSTEM = `You keep an ongoing live video stream going for Pika H3 Flex, a model that generates one short clip at a time. Each clip continues from the end of the previous one, so motion, camera and setting stay continuous across the cut. You write the prompt for the next clip.

${RULES}

For the next clip:
- Write one clear new action that moves the scene forward and fits the clip length. Build on the previous clip; do not repeat it.
- Continuation gives the model no long-term memory, so restate what must stay the same: who is there and what they wear, the setting, the light and the camera style.
- Follow the viewer's direction when one is given, without breaking continuity in a single jump.
- Continuation by frame: the clip opens on the previous clip's last frame and takes no references or audio. Write no definition lines and no <Subject N>, <Picture N> or <Audio N> labels; describe who and what appears in words. Its sound starts afresh, so describe it in full.
- Continuation by latent: the previous clip's last seconds of picture and sound carry over and the scene's references stay. Keep every definition line from the original scene verbatim at the top, in the same order, then refer to each subject only by its <Subject N> label. The carried-over sound is one more audio label, numbered after the uploaded audio; when the prompt has definition lines, define it, e.g. "<Audio 2> is the soundtrack of the previous clip, continuing."`;

/**
 * The message, split so the stable part comes first: the opening scene never
 * changes within a stream, so a provider can cache it with the system prompt.
 * The recent clips and the direction change on each call and come last.
 */
export function directorMessage(request: DirectorRequest): { stable: string; changing: string } {
  const frame = request.mode === "frame";
  const stable = [
    frame
      ? "Original scene (context only; copy none of its definition or alignment lines):"
      : "Original scene (its definition lines must open your prompt; never copy a frame alignment line):",
    request.scene.trim(),
  ].join("\n");
  const direction = request.direction.trim();
  const recent = request.recent.slice(-RECENT_CLIPS);
  const changing = [
    ...(recent.length
      ? ["Most recent clips, oldest first:", ...recent.flatMap((prompt, index) => [`--- clip ${index + 1} ---`, prompt.trim()]), ""]
      : []),
    frame
      ? `Clip length: ${request.seconds} seconds. Continuation by frame: the clip opens on the previous clip's last frame and takes no references or audio.`
      : `Clip length: ${request.seconds} seconds. Continuation by latent. Uploaded audio clips: ${request.audios}, so the carried-over sound is <Audio ${request.audios + 1}>.`,
    direction ? `Direction for the next clip: ${direction}` : "No direction given: continue the scene naturally.",
    "",
    "Write the next clip's prompt.",
  ].join("\n");
  return { stable, changing };
}

/** The writer's answer as a prompt, or null when it is empty or over budget. */
export function cleanedPrompt(raw: string): string | null {
  const text = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  const unquoted = /^"[\s\S]*"$/.test(text) ? text.slice(1, -1).trim() : text;
  const prompt = unquoted
    .split("\n")
    .filter(line => !/^(?:How the reference pictures align|For the target video, at )/.test(line.trim()))
    .join("\n")
    .trim();
  if (!prompt || Math.ceil(prompt.length / 4) > MAX_WRITTEN_TOKENS) return null;
  return prompt;
}

/** A request body from the browser, checked; null when it is malformed. */
export function parseDirectorRequest(body: unknown): DirectorRequest | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const text = (field: unknown, max: number): field is string => typeof field === "string" && field.length <= max;
  if (!text(value.scene, 20_000) || !value.scene.trim()) return null;
  if (!text(value.direction, 2_000)) return null;
  const recent = value.recent;
  if (!Array.isArray(recent) || recent.length > 10 || !recent.every(prompt => text(prompt, 20_000))) return null;
  const seconds = value.seconds;
  if (typeof seconds !== "number" || !(seconds > 0 && seconds <= 60)) return null;
  const mode = value.mode;
  if (mode !== "frame" && mode !== "latent") return null;
  const audios = value.audios;
  return {
    scene: value.scene,
    recent: recent as string[],
    direction: value.direction,
    seconds,
    mode,
    audios: typeof audios === "number" && Number.isInteger(audios) && audios >= 0 && audios <= 3 ? audios : 0,
  };
}
