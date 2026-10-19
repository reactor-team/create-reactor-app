import test from "node:test";
import assert from "node:assert/strict";
import {
  createKeySender,
  createLookSender,
  lookFromMotion,
  type Look,
  gameKey,
  validateImage,
  isExpectedCancellation,
} from "../app/lib/input.ts";

test("expected SDK disconnect errors are ignored only after explicit cancellation", () => {
  const messages = [
    "invalid state: operation requires ready status, currently disconnected",
    "control request 'request' failed (DISCONNECTED): disconnected (request_id=ctrl_1)",
  ];
  for (const message of messages) {
    assert.equal(isExpectedCancellation(message, true), true);
    assert.equal(isExpectedCancellation(message, false), false);
  }
  assert.equal(
    isExpectedCancellation("Unauthorized: token expired", true),
    false
  );
  assert.equal(
    isExpectedCancellation("Model refused: pause_required", true),
    false
  );
});

test("delayed key press cannot overtake a release on blur", async () => {
  const observed: string[][] = [];
  let releaseFirst!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const sender = createKeySender(
    async (keys) => {
      observed.push(keys);
      if (observed.length === 1) await gate;
    },
    (error) => assert.fail(String(error))
  );
  void sender.press("w");
  void sender.press("w"); // ignore browser key repeat
  void sender.press("a");
  const done = sender.clear();
  await Promise.resolve();
  assert.deepEqual(observed, [["w"]]);
  releaseFirst();
  await done;
  assert.deepEqual(observed, [["w"], ["w", "a"], []]);
});
test("one failed key command does not prevent the release command", async () => {
  const errors: unknown[] = [],
    observed: string[][] = [];
  const sender = createKeySender(
    async (keys) => {
      observed.push(keys);
      if (keys.length) throw new Error("refused");
    },
    (error) => errors.push(error)
  );
  void sender.press("shift");
  await sender.clear();
  assert.equal(errors.length, 1);
  assert.deepEqual(observed, [["shift"], []]);
});
test("a new session discards queued keys from the previous session", async () => {
  const observed: string[][] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sender = createKeySender(
    async (keys) => {
      observed.push(keys);
      if (observed.length === 1) await gate;
    },
    (error) => assert.fail(String(error))
  );
  void sender.press("w");
  await Promise.resolve();
  void sender.press("d");
  sender.reset();
  const done = sender.press("a");
  release();
  await done;
  assert.deepEqual(observed, [["w"], ["a"]]);
  await sender.clear();
  assert.deepEqual(observed.at(-1), []);
});
test("wire keys retain exact case and space normalization", () => {
  assert.equal(gameKey("ArrowUp"), "arrowup");
  assert.equal(gameKey("W"), "w");
  assert.equal(gameKey(" "), " ");
  assert.equal(gameKey("Enter"), null);
});
test("look sender keeps one command in flight and sends only the latest rate", async () => {
  const observed: Look[] = [];
  let releaseFirst!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const looks = createLookSender(
    async (look) => {
      observed.push(look);
      if (observed.length === 1) await gate;
    },
    (error) => assert.fail(String(error))
  );
  void looks.set(0.5, 0);
  void looks.set(0.6, 0.1);
  void looks.set(0.71, -0.2);
  await Promise.resolve();
  assert.deepEqual(observed, [{ yaw: 0.5, pitch: 0 }]);
  releaseFirst();
  await looks.set(0.7, -0.2); // same 0.05 step as 0.71: nothing new to send
  assert.deepEqual(observed, [
    { yaw: 0.5, pitch: 0 },
    { yaw: 0.7, pitch: -0.2 },
  ]);
  await looks.clear();
  await looks.clear();
  assert.deepEqual(observed.at(-1), { yaw: 0, pitch: 0 });
  assert.equal(observed.length, 3);
});
test("a look rate set after a no-op clear is still sent", async () => {
  const observed: Look[] = [];
  const looks = createLookSender(
    async (look) => {
      observed.push(look);
    },
    (error) => assert.fail(String(error))
  );
  await looks.clear(); // what the controls do on mount, with nothing held
  await looks.set(0.5, 0.25);
  await looks.clear();
  assert.deepEqual(observed, [
    { yaw: 0.5, pitch: 0.25 },
    { yaw: 0, pitch: 0 },
  ]);
});
test("a failed look command does not stop the stop command", async () => {
  const errors: unknown[] = [],
    observed: Look[] = [];
  const looks = createLookSender(
    async (look) => {
      observed.push(look);
      if (look.yaw) throw new Error("refused");
    },
    (error) => errors.push(error)
  );
  await looks.set(1, 0);
  await looks.clear();
  assert.equal(errors.length, 1);
  assert.deepEqual(observed, [
    { yaw: 1, pitch: 0 },
    { yaw: 0, pitch: 0 },
  ]);
});
test("a new session discards a queued look rate from the previous session", async () => {
  const observed: Look[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const looks = createLookSender(
    async (look) => {
      observed.push(look);
      if (observed.length === 1) await gate;
    },
    (error) => assert.fail(String(error))
  );
  const old = looks.set(0.5, 0);
  void looks.set(0.7, 0);
  looks.reset();
  await looks.set(0.2, 0);
  release();
  await old;
  assert.deepEqual(observed, [
    { yaw: 0.5, pitch: 0 },
    { yaw: 0.2, pitch: 0 },
  ]);
});
test("locked-pointer motion eases into a look rate and settles when the mouse stops", () => {
  const still = { yaw: 0, pitch: 0 };
  const right = lookFromMotion(still, 50, 0, 0.033); // about 1500 px/s
  assert.ok(right.yaw > 0.4 && right.yaw <= 0.5);
  assert.equal(right.pitch, 0);
  const up = lookFromMotion(still, 0, -25, 0.033);
  assert.ok(up.pitch > 0);
  const flung = lookFromMotion({ yaw: 1, pitch: 0 }, 5000, 0, 0.033);
  assert.equal(flung.yaw, 1);
  let look = { yaw: 1, pitch: -1 };
  for (let i = 0; i < 6; i++) look = lookFromMotion(look, 0, 0, 0.033);
  assert.deepEqual(look, still);
});
test("the key sender reports what is held for the key map", async () => {
  const sender = createKeySender(
    async () => undefined,
    (error) => assert.fail(String(error))
  );
  void sender.press("w");
  void sender.press(" ");
  assert.deepEqual(sender.held(), ["w", " "]);
  void sender.release("w");
  assert.deepEqual(sender.held(), [" "]);
  await sender.clear();
  assert.deepEqual(sender.held(), []);
});
test("image limits reject unsafe inputs before upload", () => {
  const file = { type: "image/png", size: 25 * 1024 * 1024 };
  assert.doesNotThrow(() => validateImage(file, 4000, 4000));
  assert.throws(
    () => validateImage({ ...file, size: file.size + 1 }, 100, 100),
    /25 MiB/
  );
  assert.throws(() => validateImage(file, 4001, 4000), /16 megapixels/);
  assert.throws(
    () => validateImage({ ...file, type: "image/svg+xml" }, 10, 10),
    /PNG/
  );
  assert.throws(() => validateImage({ ...file, size: 0 }, 10, 10), /non-empty/);
});
