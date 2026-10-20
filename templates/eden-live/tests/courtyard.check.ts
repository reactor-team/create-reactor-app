import { test } from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { courtyardTriangles } from "../app/lib/courtyard-physics.ts";
import { WORLD_SCENES } from "../app/lib/world.ts";

test("courtyard collisions use world transforms and leave shared geometry unchanged", () => {
  const scene = new Scene();
  const wall = new Group();
  wall.name = "CourtyardWalls";
  wall.position.set(10, 0, 2);
  wall.rotation.y = Math.PI / 2;
  const geometry = new BoxGeometry(2, 4, 6);
  const original = Array.from(geometry.attributes.position.array);
  wall.add(new Mesh(geometry, new MeshBasicMaterial()));
  scene.add(wall);
  const [vertices, indices] = courtyardTriangles(scene);
  const x = Array.from(vertices).filter((_, index) => index % 3 === 0);
  const z = Array.from(vertices).filter((_, index) => index % 3 === 2);
  assert.equal(Math.min(...x), 7);
  assert.equal(Math.max(...x), 13);
  assert.equal(Math.min(...z), 1);
  assert.equal(Math.max(...z), 3);
  assert.equal(indices.length, 36);
  assert.deepEqual(Array.from(geometry.attributes.position.array), original);
});

test("water and distant scenery do not obstruct courtyard movement", () => {
  const scene = new Scene();
  const props = new Group();
  props.name = "CourtCentre";
  props.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));
  const water = new Mesh(
    new BoxGeometry(100, 100, 100),
    new MeshBasicMaterial({ transparent: true })
  );
  props.add(water);
  scene.add(
    props,
    new Mesh(new BoxGeometry(1000, 1000, 1000), new MeshBasicMaterial())
  );
  const [vertices, indices] = courtyardTriangles(scene);
  assert.equal(vertices.length, 72);
  assert.equal(indices.length, 36);
  assert.ok(Array.from(vertices).every((value) => Math.abs(value) <= 1));
});

test("courtyard spawn clears the central fountain and stays inside the perimeter", () => {
  const [x, y, z] = WORLD_SCENES.courtyard.spawn;
  // Fountain radius 1.2m plus the capsule radius and controller clearance.
  assert.ok(Math.hypot(x, z) > 1.2 + 0.35 + 0.02);
  assert.ok(Math.abs(x) < 9 && Math.abs(z) < 9);
  assert.ok(y >= 0.9);
});
