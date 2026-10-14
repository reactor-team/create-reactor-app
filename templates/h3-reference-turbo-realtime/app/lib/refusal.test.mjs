import assert from "node:assert/strict";
import test from "node:test";
import { belongsTo, GENERIC_REFUSAL, refusalOf } from "./refusal.ts";

// The message the SDK builds for a command the model refused.
function refused(command, code, reason) {
  return {
    code,
    message: `command '${command}' failed (${code}): ${reason}`,
    operation: "sendCommand",
  };
}

test("a refusal yields the model's code and its reason without the SDK prefix", () => {
  const failure = refused(
    "enqueue",
    "queue_full",
    "The generation queue is full (20 clips).",
  );
  assert.deepEqual(refusalOf("enqueue", failure), {
    command: "enqueue",
    code: "queue_full",
    reason: "The generation queue is full (20 clips).",
  });
});

test("a reason that spans lines or holds a colon is kept whole", () => {
  const failure = refused(
    "enqueue",
    "invalid_request",
    "Pass one of:\n`starting_frame` or `continue_from_clip_id`.",
  );
  assert.equal(
    refusalOf("enqueue", failure).reason,
    "Pass one of:\n`starting_frame` or `continue_from_clip_id`.",
  );
});

test("the typed code wins over the code in the message", () => {
  const failure = {
    ...refused("pop", "unknown_clip", "No queued clip."),
    code: "clip_referenced",
  };
  assert.equal(refusalOf("pop", failure).code, "clip_referenced");
});

test("a model refusal in other wording keeps its code and never shows the SDK's text", () => {
  const failure = {
    code: "queue_full",
    message:
      "Command enqueue was rejected [queue_full]: The generation queue is full.",
    operation: "sendCommand",
  };
  assert.deepEqual(refusalOf("enqueue", failure), {
    command: "enqueue",
    code: "queue_full",
    reason: GENERIC_REFUSAL,
  });
});

test("a failure the SDK raised itself shows the SDK's message", () => {
  const failure = {
    code: "INVALID_STATE",
    message: "Not connected.",
    operation: "sendCommand",
  };
  assert.deepEqual(refusalOf("enqueue", failure), {
    command: "enqueue",
    code: "INVALID_STATE",
    reason: "Not connected.",
  });
});

test("a refusal belongs only to the command it names, matched exactly", () => {
  const failure = refused(
    "set_canvas",
    "session_not_empty",
    "Clips are queued.",
  );
  assert.equal(belongsTo("set_canvas", failure), true);
  assert.equal(belongsTo("set_canvas_size", failure), false);
  assert.equal(belongsTo("set", failure), false);
  assert.equal(belongsTo("enqueue", failure), false);
});

test("a failure that names no command belongs to the call in flight", () => {
  assert.equal(
    belongsTo("play", {
      code: "INVALID_STATE",
      message: "Not connected.",
      operation: "sendCommand",
    }),
    true,
  );
  assert.equal(
    belongsTo("play", {
      code: "not_playing",
      message: "reworded",
      operation: "sendCommand",
    }),
    true,
  );
});

test("a failure of another operation belongs to no command", () => {
  assert.equal(
    belongsTo("enqueue", {
      ...refused("enqueue", "queue_full", "Full."),
      operation: "connect",
    }),
    false,
  );
  assert.equal(
    belongsTo("enqueue", { code: "NETWORK_ERROR", message: "offline" }),
    false,
  );
});
