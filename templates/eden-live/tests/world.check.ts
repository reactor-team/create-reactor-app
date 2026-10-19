import test from "node:test";
import assert from "node:assert/strict";
import { worldMovement } from "../app/lib/world.ts";

test("diagonal movement has the same speed as cardinal movement", () => {
  const straight = worldMovement(new Set(["w"]));
  const diagonal = worldMovement(new Set(["w", "d"]));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10);
  assert.equal(diagonal.speed, straight.speed);
});

test("opposing keys stop movement and sprint changes speed only", () => {
  const stopped = worldMovement(new Set(["w", "s", "a", "d"]));
  assert.equal(stopped.x, 0);
  assert.equal(stopped.z, 0);
  const sprint = worldMovement(new Set(["arrowup", "shift"]));
  assert.equal(sprint.z, 1);
  assert.ok(sprint.speed > stopped.speed);
});
