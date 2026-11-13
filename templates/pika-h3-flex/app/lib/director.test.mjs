import assert from "node:assert/strict";
import test from "node:test";
import { DIRECTOR_SYSTEM, RECENT_CLIPS, cleanedPrompt, directorMessage, parseDirectorRequest } from "./director.ts";
import { FIRST_FRAME_LINE, frameContinuationFromWritten } from "./prompt.ts";

const request = {
  scene: "[Shot 1] A paper boat drifts down a rain-filled gutter at dusk.",
  recent: ["clip one", "clip two", "clip three", "clip four"],
  direction: "",
  seconds: 15.083,
  mode: "frame",
  audios: 0,
};

test("the scene comes first and stays the same; recent clips and the direction come last", () => {
  const first = directorMessage(request);
  const steered = directorMessage({ ...request, recent: ["clip five"], direction: "the storm breaks" });
  assert.equal(first.stable, steered.stable);
  assert.ok(first.stable.includes(request.scene));
  assert.ok(!first.stable.includes("clip"));
  assert.ok(steered.changing.includes("Direction for the next clip: the storm breaks"));
  assert.ok(first.changing.includes("No direction given"));
  // Only the most recent clips, oldest first.
  assert.ok(!first.changing.includes("clip one"));
  assert.ok(first.changing.indexOf("clip two") < first.changing.indexOf("clip four"));
  assert.equal(RECENT_CLIPS, 3);
  assert.ok(!DIRECTOR_SYSTEM.includes(request.scene));
});

test("frame and latent requests say which continuation the clip is", () => {
  assert.ok(directorMessage(request).changing.includes("Continuation by frame"));
  const latent = directorMessage({ ...request, mode: "latent", audios: 2 });
  assert.ok(latent.changing.includes("<Audio 3>"));
  assert.ok(latent.stable.includes("definition lines must open your prompt"));
});

test("the writer's answer loses fences, quotes and alignment lines, and is refused when empty", () => {
  assert.equal(cleanedPrompt("```\n[Shot 1] The boat tips.\n```"), "[Shot 1] The boat tips.");
  assert.equal(cleanedPrompt("\"[Shot 1] The boat tips.\""), "[Shot 1] The boat tips.");
  assert.equal(cleanedPrompt(`${FIRST_FRAME_LINE}\n\n[Shot 1] The boat tips.`), "[Shot 1] The boat tips.");
  assert.equal(cleanedPrompt("   "), null);
  assert.equal(cleanedPrompt("word ".repeat(2000)), null);
});

test("a written frame continuation opens on the first-frame line and drops labels", () => {
  const prompt = frameContinuationFromWritten("<Subject 1> is the boat from <Picture 1>.\n[Shot 1] <Subject 1> spins in the current.");
  assert.ok(prompt.startsWith(`${FIRST_FRAME_LINE}\n\n`));
  assert.ok(!prompt.includes("<Subject"));
  assert.ok(prompt.includes("spins in the current"));
});

test("malformed director requests are refused", () => {
  assert.deepEqual(parseDirectorRequest(request), request);
  assert.equal(parseDirectorRequest({ ...request, scene: " " }), null);
  assert.equal(parseDirectorRequest({ ...request, mode: "sideways" }), null);
  assert.equal(parseDirectorRequest({ ...request, recent: "clip" }), null);
  assert.equal(parseDirectorRequest({ ...request, seconds: -1 }), null);
  assert.equal(parseDirectorRequest(null), null);
  assert.equal(parseDirectorRequest({ ...request, audios: 9 }).audios, 0);
});
