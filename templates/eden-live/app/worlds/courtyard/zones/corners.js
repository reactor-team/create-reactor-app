import * as THREE from 'three';
import { buildTree } from '../assets/tree.js';

// Corners — one tree per courtyard corner at (±7.5, ±7.5), each on a 2x2 m
// grass bed edged with a low stone curb; crowns vary in shape, lean and hue.

function makeGrassBed(T, seed) {
  const g = new T.Group();
  g.name = 'GrassBed';
  const grassMat = new T.MeshStandardMaterial({ color: 0x557a38, roughness: 1, metalness: 0 });
  const curbMat = new T.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.9, metalness: 0 });

  // grass slab: 2x2 m, top at y=0.12 (just under the 0.15 curb)
  const slab = new T.Mesh(new T.BoxGeometry(1.84, 0.12, 1.84), grassMat);
  slab.position.y = 0.06;
  slab.receiveShadow = true;
  g.add(slab);

  // low stone curb, 0.15 m high, framing the bed
  const curbGeoLong = new T.BoxGeometry(2.0, 0.15, 0.1);
  const curbGeoShort = new T.BoxGeometry(0.1, 0.15, 1.8);
  const c1 = new T.Mesh(curbGeoLong, curbMat); c1.position.set(0, 0.075, 0.95);
  const c2 = new T.Mesh(curbGeoLong, curbMat); c2.position.set(0, 0.075, -0.95);
  const c3 = new T.Mesh(curbGeoShort, curbMat); c3.position.set(0.95, 0.075, 0);
  const c4 = new T.Mesh(curbGeoShort, curbMat); c4.position.set(-0.95, 0.075, 0);
  for (const c of [c1, c2, c3, c4]) { c.castShadow = true; c.receiveShadow = true; g.add(c); }

  // a few small grass tufts so the bed does not read as a flat plate
  const tuftMat = new T.MeshStandardMaterial({ color: 0x5f8a3e, roughness: 1, metalness: 0 });
  const tuftGeo = new T.ConeGeometry(0.05, 0.14, 5);
  const spots = [[-0.6, 0.5], [0.55, -0.62], [0.62, 0.58], [-0.55, -0.5], [0.1, -0.7]];
  for (const [x, z] of spots) {
    const tuft = new T.Mesh(tuftGeo, tuftMat);
    tuft.position.set(x, 0.19, z);
    tuft.rotation.y = (x * 7 + z * 13 + seed) % 3;
    tuft.castShadow = true;
    g.add(tuft);
  }
  return g;
}

export function build(ctx) {
  const { THREE: T, heightAt } = ctx;
  const g = new T.Group();
  g.name = 'Corners';
  const animated = [];

  // corner -> [x, z, yawDeg, variant, hue, lean]
  const corners = [
    [-7.5, -7.5, 45, 0, 0x4a7a30, 0.03],
    [7.5, -7.5, 315, 1, 0x557f33, -0.025],
    [-7.5, 7.5, 135, 2, 0x608536, 0.02],
    [7.5, 7.5, 225, 3, 0x6a8a3a, -0.035],
  ];

  corners.forEach(([x, z, yawDeg, variant, hue, lean], i) => {
    const y = heightAt ? heightAt(x, z) : 0;

    const bed = makeGrassBed(T, i);
    bed.name = 'GrassBed' + i;
    bed.position.set(x, y, z);
    g.add(bed);

    const tree = buildTree(T, { variant, seed: 11 + i * 7, hue });
    tree.name = 'Tree' + i;
    // seat the tree on the grass bed surface (slab top at local y=0.12)
    tree.position.set(x, y + 0.12, z);
    tree.rotation.y = (yawDeg * Math.PI) / 180;
    tree.rotation.z = lean; // slight per-corner lean so they are not copies
    tree.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(tree);
    if (tree.userData && typeof tree.userData.update === 'function') {
      animated.push(tree);
    }
  });

  g.userData.update = (t, dt) => {
    for (const a of animated) a.userData.update(t, dt);
  };
  return g;
}
