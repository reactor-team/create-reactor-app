import * as THREE from 'three';

// Tiny deterministic PRNG (mulberry32-style) so we don't depend on lib layout.
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildTree(THREE, opts = {}) {
  const variant = (opts.variant | 0) % 4;
  const rand = mulberry32(((opts.seed ?? 1) * 2654435761) ^ (variant * 7919));

  const group = new THREE.Group();
  group.name = 'Tree';

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9, flatShading: true });

  // Hue variation across copies: base greens 0x4a7a30..0x6a8a3a, shifted by opts.hue/seed.
  const hueShift = (opts.hue !== undefined ? opts.hue : (rand() - 0.5) * 0.06);
  const leafColors = [0x4a7a30, 0x567f33, 0x6a8a3a].map((c) => {
    const col = new THREE.Color(c);
    const hsl = {};
    col.getHSL(hsl);
    col.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, hsl.l);
    return col;
  });

  // ---- Trunk: tapered, 0.25 m diameter at base, 1.8 m to first branch ----
  const leanAmt = [0.0, 0.10, -0.08, 0.05][variant];
  const trunk = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.055, 0.125, 1.8, 8, 3);
  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.position.y = 0.9;
  trunk.add(trunkMesh);

  // Root flare
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.17, 0.15, 8), barkMat);
  flare.position.y = 0.075;
  trunk.add(flare);

  // ---- Branches (2-3) reaching into the crown ----
  const branchDefs = [
    { yaw: 0.4 + rand() * 0.6, tilt: 0.7, len: 0.85 },
    { yaw: 2.4 + rand() * 0.6, tilt: 0.85, len: 0.75 },
    { yaw: 4.4 + rand() * 0.6, tilt: 0.6, len: 0.7 },
  ];
  const branchTips = [];
  for (const b of branchDefs) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, b.len, 6), barkMat);
    br.position.y = 1.8;
    br.rotation.y = b.yaw;
    br.rotateX(b.tilt);
    br.translateY(b.len / 2 - 0.05);
    trunk.add(br);
    br.updateMatrix();
    const tip = new THREE.Vector3(0, b.len / 2, 0).applyMatrix4(br.matrix);
    branchTips.push(tip);
  }

  trunk.rotation.z = leanAmt;
  trunk.rotation.x = leanAmt * 0.4;
  group.add(trunk);

  // ---- Crown: 2-3 icosahedron foliage blobs, ~2.5 m across ----
  const crown = new THREE.Group();
  const crownBaseY = 2.55; // centre of crown mass; total height ~4.0

  // Variant crown shapes: 0 round, 1 oval/tall, 2 wide, 3 asymmetric
  const blobDefs = [];
  if (variant === 0) {
    blobDefs.push(
      { p: [0, crownBaseY + 0.35, 0], s: [1.05, 1.0, 1.05], c: 0 },
      { p: [0.62, crownBaseY - 0.15, 0.25], s: [0.72, 0.68, 0.72], c: 1 },
      { p: [-0.6, crownBaseY - 0.1, -0.3], s: [0.68, 0.64, 0.68], c: 2 },
    );
  } else if (variant === 1) {
    blobDefs.push(
      { p: [0, crownBaseY + 0.55, 0], s: [0.8, 1.05, 0.8], c: 0 },
      { p: [0.15, crownBaseY - 0.25, 0.1], s: [0.85, 0.8, 0.85], c: 1 },
      { p: [-0.45, crownBaseY + 0.1, -0.35], s: [0.6, 0.62, 0.6], c: 2 },
    );
  } else if (variant === 2) {
    blobDefs.push(
      { p: [0, crownBaseY + 0.15, 0], s: [1.15, 0.8, 1.15], c: 0 },
      { p: [0.75, crownBaseY - 0.1, -0.3], s: [0.62, 0.55, 0.62], c: 1 },
      { p: [-0.72, crownBaseY - 0.05, 0.35], s: [0.6, 0.55, 0.6], c: 2 },
    );
  } else {
    blobDefs.push(
      { p: [0.15, crownBaseY + 0.4, 0], s: [0.95, 0.95, 0.95], c: 0 },
      { p: [-0.55, crownBaseY + 0.05, 0.3], s: [0.78, 0.72, 0.78], c: 1 },
      { p: [0.55, crownBaseY - 0.35, -0.35], s: [0.55, 0.5, 0.55], c: 2 },
    );
  }

  const leafMats = leafColors.map((c) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true })
  );

  for (const bd of blobDefs) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    // Slight deterministic vertex jitter for an organic silhouette
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const j = 0.88 + rand() * 0.24;
      pos.setXYZ(i, pos.getX(i) * j, pos.getY(i) * j, pos.getZ(i) * j);
    }
    geo.computeVertexNormals();
    const blob = new THREE.Mesh(geo, leafMats[bd.c]);
    blob.position.set(bd.p[0], bd.p[1], bd.p[2]);
    blob.scale.set(bd.s[0], bd.s[1], bd.s[2]);
    blob.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    crown.add(blob);
  }

  // Crown follows the trunk lean so nothing floats
  crown.rotation.z = leanAmt;
  crown.rotation.x = leanAmt * 0.4;
  group.add(crown);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  group.userData.size = [2.5, 4.0, 2.5];

  // Gentle sway — visible amplitude after 1.5 s
  const phase = rand() * Math.PI * 2;
  group.userData.update = (t) => {
    const sway = Math.sin(t * 1.2 + phase) * 0.06;
    crown.rotation.z = leanAmt + sway;
    crown.rotation.x = leanAmt * 0.4 + Math.cos(t * 0.9 + phase) * 0.05;
  };

  return group;
}
