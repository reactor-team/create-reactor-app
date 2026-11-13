import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CLIP_SECONDS,
  PROMPT_TOKEN_BUDGET,
  estimatePromptTokens,
  nearestChoice,
  validateDraft,
} from "./scene.ts";

// v3.0.0's lengths, as a session reports them in state_update.clip_seconds_choices.
const CHOICES = [5, 5.167, 5.875, 6, 6.583, 7, 7.292, 8, 8.708, 9, 9.417, 10, 10.125, 10.833, 11, 11.542, 12, 12.25, 12.958, 13, 13.667, 14, 14.375, 15, 15.083];

const draft = (overrides = {}) => ({
  prompt: "A robot waves.",
  images: [],
  audio: [],
  seconds: DEFAULT_CLIP_SECONDS,
  aspect: "16:9",
  resolution: "768p",
  firstFrame: null,
  lastFrame: null,
  continueFromClipId: null,
  continueMode: "latent",
  ...overrides,
});
const file = (name, type, size = 1) => ({ name, type, size });
const image = file("one.png", "image/png");
const audio = file("one.wav", "audio/wav");

test("lengths come from the session; the default is one of them", () => {
  assert.ok(CHOICES.includes(DEFAULT_CLIP_SECONDS));
  for (const seconds of CHOICES) assert.deepEqual(validateDraft(draft({ seconds }), CHOICES), []);
  assert.match(validateDraft(draft({ seconds: 9.5 }), CHOICES)[0], /session's clip lengths/);
  // Before a session exists there is no list to check against.
  assert.deepEqual(validateDraft(draft({ seconds: 9.5 }), null), []);
  assert.equal(nearestChoice(9.5, CHOICES), 9.417);
  assert.equal(nearestChoice(10, CHOICES), 10);
});

test("an empty prompt is rejected", () => {
  assert.equal(validateDraft(draft({ prompt: "   " }), CHOICES).length, 1);
});

test("audio needs a picture or a latent continuation, three either way", () => {
  assert.match(validateDraft(draft({ audio: [audio] }), CHOICES)[0], /need a picture/);
  assert.deepEqual(validateDraft(draft({ audio: [audio], images: [image] }), CHOICES), []);
  assert.deepEqual(validateDraft(draft({ audio: [audio, audio, audio], continueFromClipId: "clip-1" }), CHOICES), []);
  assert.match(validateDraft(draft({ audio: [audio, audio, audio, audio], images: [image] }), CHOICES)[0], /at most 3/);
});

test("first and last frames never come with references or a continuation", () => {
  assert.deepEqual(validateDraft(draft({ firstFrame: image }), CHOICES), []);
  assert.deepEqual(validateDraft(draft({ lastFrame: image }), CHOICES), []);
  assert.deepEqual(validateDraft(draft({ firstFrame: image, lastFrame: image }), CHOICES), []);
  assert.match(validateDraft(draft({ firstFrame: image, images: [image] }), CHOICES)[0], /can't be combined with reference/);
  assert.match(validateDraft(draft({ lastFrame: image, continueFromClipId: "clip-1" }), CHOICES)[0], /independent/);
});

test("a frame continuation is prompt only", () => {
  assert.deepEqual(validateDraft(draft({ continueFromClipId: "clip-1", continueMode: "frame" }), CHOICES), []);
  const errors = validateDraft(draft({ continueFromClipId: "clip-1", continueMode: "frame", images: [image] }), CHOICES);
  assert.match(errors[0], /takes no references/);
});

test("invalid file types and oversized files are reported", () => {
  const errors = validateDraft(draft({
    images: [file("image.gif", "image/gif", 26 * 1024 * 1024)],
    audio: [file("audio.txt", "text/plain")],
  }), CHOICES);
  assert.equal(errors.length, 3);
  assert.equal(validateDraft(draft({ firstFrame: file("frame.gif", "image/gif") }), CHOICES).length, 1);
});

test("the token estimate counts reference and frame labels against the 2048 budget", () => {
  const bare = estimatePromptTokens(draft({ prompt: "x".repeat(400) }));
  assert.equal(bare, 100);
  assert.ok(estimatePromptTokens(draft({ prompt: "x".repeat(400), images: [image, image] })) > bare);
  assert.ok(estimatePromptTokens(draft({ prompt: "x".repeat(400), firstFrame: image })) > bare);
  assert.ok(estimatePromptTokens(draft({ prompt: "x".repeat(4 * PROMPT_TOKEN_BUDGET + 4) })) > PROMPT_TOKEN_BUDGET);
});
