import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIP_SECONDS_CHOICES,
  DEFAULT_CLIP_SECONDS,
  validateDraft,
} from "./scene.ts";

const draft = (overrides = {}) => ({
  prompt: "A robot waves.",
  images: [],
  audio: [],
  seconds: DEFAULT_CLIP_SECONDS,
  continueFromClipId: null,
  ...overrides,
});
const file = (name, type, size = 1) => ({ name, type, size });

test("text-only clips and the five published durations are accepted", () => {
  assert.equal(DEFAULT_CLIP_SECONDS, 8);
  for (const seconds of CLIP_SECONDS_CHOICES) {
    assert.deepEqual(validateDraft(draft({ seconds })), []);
  }
});

test("invalid duration and empty prompt are rejected", () => {
  assert.equal(validateDraft(draft({ seconds: 5, prompt: "   " })).length, 2);
});

test("audio needs an image or continuation and has a lower continuation limit", () => {
  const audio = [file("one.wav", "audio/wav")];
  assert.match(validateDraft(draft({ audio }))[0], /need an image/);
  assert.deepEqual(
    validateDraft(draft({ audio, images: [file("one.png", "image/png")] })),
    [],
  );
  assert.match(
    validateDraft(
      draft({
        audio: [...audio, ...audio, ...audio],
        continueFromClipId: "clip-1",
      }),
    )[0],
    /at most 2/,
  );
});

test("invalid file types and oversized files are reported", () => {
  const errors = validateDraft(
    draft({
      images: [file("image.gif", "image/gif", 26 * 1024 * 1024)],
      audio: [file("audio.txt", "text/plain")],
    }),
  );
  assert.equal(errors.length, 3);
});
