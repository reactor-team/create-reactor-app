import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_FRAME_LINE,
  assembleBasicPrompt,
  assembleFramePrompt,
  definitionLines,
  frameAlignmentLine,
  frameContinuationPrompt,
  frameSet,
  pictureTokens,
  withoutReferences,
} from "./prompt.ts";

const ramen = {
  text: "Aki hands Jun a bowl at the Ramen bar.",
  pictures: [
    { name: "Aki", kind: "person", description: "the chef in a navy bandana" },
    { name: "Jun", kind: "person", description: "" },
    { name: "Ramen bar", kind: "setting", description: "a late-night counter" },
  ],
  audios: [{ role: "voice", speaker: "Aki" }, { role: "music", speaker: "" }],
};

test("definition lines follow the prompt guide's wording, in upload order", () => {
  const lines = definitionLines(ramen.pictures, ramen.audios);
  assert.equal(lines[0], "<Subject 1> is Aki, the chef in a navy bandana, the character from <Picture 1>, retaining appearance and clothing.");
  assert.equal(lines[1], "<Subject 2> is Jun, the character from <Picture 2>, retaining appearance and clothing.");
  assert.equal(lines[2], "<Subject 3> is Ramen bar, a late-night counter, the setting from <Picture 3>, retaining its layout and visual style.");
  assert.equal(lines[3], "<Audio 1> is the voice of <Subject 1>.");
  assert.equal(lines[4], "<Audio 2> is the music for this clip.");
});

test("names in the description become their labels, whole words only", () => {
  const prompt = assembleBasicPrompt(ramen);
  assert.match(prompt, /<Subject 1> hands <Subject 2> a bowl at the <Subject 3>\.$/);
  const cup = assembleBasicPrompt({ text: "The Cup sits near the Cupboard.", pictures: [{ name: "Cup", kind: "object", description: "" }], audios: [] });
  assert.match(cup, /The <Subject 1> sits near the Cupboard\./);
});

test("every picture's content is a <Subject N>, a style included", () => {
  const pictures = [{ name: "Look", kind: "style", description: "muted 1970s film" }, { name: "Ana", kind: "person", description: "" }];
  assert.deepEqual(pictureTokens(pictures), ["<Subject 1>", "<Subject 2>"]);
  assert.equal(definitionLines(pictures, [])[0], "<Subject 1> is Look, muted 1970s film, the visual style from <Picture 1>, used only for the look: light, colour and texture.");
});

test("text alone passes through unchanged", () => {
  assert.equal(assembleBasicPrompt({ text: "  A storm at sea.  ", pictures: [], audios: [] }), "A storm at sea.");
});

test("frame alignment lines follow Pika's guide for each set of frames", () => {
  assert.equal(frameSet(true, false), "first");
  assert.equal(frameSet(false, true), "last");
  assert.equal(frameSet(true, true), "both");
  assert.equal(frameSet(false, false), null);
  assert.equal(frameAlignmentLine("first", 8), FIRST_FRAME_LINE);
  assert.match(frameAlignmentLine("last", 8), /<Picture 1> \(from \[Shot 1\]\) aligns with the 8\.00-second mark/);
  const both = frameAlignmentLine("both", 10);
  assert.match(both, /<Picture 1> \(from \[Shot 1\]\) aligns with the 0\.00-second mark/);
  assert.match(both, /<Picture 2> \(from \[Shot 1\]\) aligns with the 10\.00-second mark/);
  assert.equal(assembleFramePrompt(" The cup tips over. ", "first", 8), `${FIRST_FRAME_LINE}\n\nThe cup tips over.`);
});

test("a frame continuation drops references and names the subjects", () => {
  const scene = [
    "<Subject 1> is Marcy, curly red hair, the character from <Picture 1>, retaining appearance and clothing.",
    "<Subject 2> is the setting from <Picture 2>, retaining its layout and visual style.",
    "<Audio 1> is the voice of <Subject 1>.",
    "<Subject 1> waves in <Subject 2>, exactly like <Picture 1>.",
  ].join("\n");
  assert.equal(withoutReferences(scene), "Marcy waves in the setting, exactly like the reference.");
  const prompt = frameContinuationPrompt(scene, "she sits down");
  assert.ok(prompt.startsWith(`${FIRST_FRAME_LINE}\n\n`));
  assert.match(prompt, /Next beat: she sits down$/);
  assert.doesNotMatch(prompt.split("\n").slice(1).join("\n"), /<(Subject|Audio)/);
});
