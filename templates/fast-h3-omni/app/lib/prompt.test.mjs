import assert from "node:assert/strict";
import test from "node:test";
import { assembleGuidedPrompt } from "./prompt.ts";

test("guided prompt binds numbered files to their displayed order and roles", () => {
  const prompt = assembleGuidedPrompt({
    action: "Aki hands Jun a bowl in the ramen bar.",
    camera: "Slow push-in.",
    sound: "Rain on the window.",
    music: "",
    pictures: [
      { name: "Aki", kind: "person", description: "the chef in a navy bandana" },
      { name: "Jun", kind: "person", description: "the guest in a grey coat" },
      { name: "ramen bar", kind: "scene", description: "a late-night counter under red lanterns" },
    ],
    audios: [
      { role: "voice", speaker: "Aki" },
      { role: "soundtrack", speaker: "" },
    ],
  });
  assert.match(prompt, /<Subject 1> is Aki, the chef in a navy bandana in <Picture 1>\./);
  assert.match(prompt, /<Subject 2> is Jun, the guest in a grey coat in <Picture 2>\./);
  assert.match(prompt, /<Picture 3> is the scene reference: a late-night counter under red lanterns\./);
  assert.match(prompt, /<Audio 1> is the voice of <Subject 1>\./);
  assert.match(prompt, /<Subject 1> hands <Subject 2> a bowl in the <Picture 3>\./);
  assert.match(prompt, /<Audio 2> is the target video's complete audio track, reused unchanged\./);
  assert.match(prompt, /Camera: Slow push-in\./);
  assert.doesNotMatch(prompt, /Sound: Rain on the window\./);
});

test("named objects become object tokens without replacing parts of other words", () => {
  const prompt = assembleGuidedPrompt({
    action: "The cup sits near the Cupboard.",
    camera: "",
    sound: "",
    music: "",
    pictures: [{ name: "Cup", kind: "object", description: "a white espresso cup" }],
    audios: [],
  });
  assert.match(prompt, /<Object 1> is Cup, a white espresso cup in <Picture 1>\./);
  assert.match(prompt, /The <Object 1> sits near the Cupboard\./);
});

test("generated sound remains in the prompt when no complete soundtrack is attached", () => {
  const prompt = assembleGuidedPrompt({
    action: "A cup fills with coffee.",
    camera: "",
    sound: "Steam hisses.",
    music: "A warm beat.",
    pictures: [],
    audios: [],
  });
  assert.match(prompt, /Sound: Steam hisses\./);
  assert.match(prompt, /Music: A warm beat\./);
});
