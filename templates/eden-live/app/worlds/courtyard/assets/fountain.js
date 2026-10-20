import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFountain(THREE, opts = {}) {
  const seed = opts.seed ?? 1;
  const variant = opts.variant ?? 0;
  const rand = mulberry32(seed);

  const group = new THREE.Group();
  group.name = 'Fountain';

  // Stone colour with slight per-instance variation
  const stoneCol = new THREE.Color(0x9a948a);
  if (opts.tint) stoneCol.multiply(new THREE.Color(opts.tint));
  const hOff = (rand() - 0.5) * 0.04;
  stoneCol.offsetHSL(hOff, 0, (rand() - 0.5) * 0.06);

  const stoneMat = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 0.9, metalness: 0.0 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: stoneCol.clone().multiplyScalar(0.82), roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3a6a7a, roughness: 0.15, metalness: 0.1,
    transparent: true, opacity: 0.85
  });

  // ---- Lower basin: octagonal rim, 2.4 m across, rim top at 0.55 m ----
  const R = 1.2;            // outer radius (corner to centre)
  const rIn = 1.02;         // inner water radius
  const rimH = 0.55;

  // Lathe profile for the basin wall (octagonal via low radial segments)
  const basinPts = [
    new THREE.Vector2(R * 0.92, 0.0),
    new THREE.Vector2(R, 0.06),
    new THREE.Vector2(R, rimH - 0.08),
    new THREE.Vector2(R * 1.0, rimH),       // outer top edge
    new THREE.Vector2(R * 0.94, rimH),      // rim top
    new THREE.Vector2(rIn, rimH - 0.02),    // inner top
    new THREE.Vector2(rIn, 0.12),           // inner wall down
    new THREE.Vector2(rIn * 0.9, 0.08),
  ];
  const basinGeo = new THREE.LatheGeometry(basinPts, 8);
  const basin = new THREE.Mesh(basinGeo, stoneMat);
  basin.rotation.y = Math.PI / 8; // flat face to front
  group.add(basin);

  // Basin floor (inside)
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn * 0.95, 0.1, 8), stoneDark);
  floor.position.y = 0.1;
  floor.rotation.y = Math.PI / 8;
  group.add(floor);

  // Water disc at y = 0.35
  const water = new THREE.Mesh(new THREE.CylinderGeometry(rIn - 0.02, rIn - 0.02, 0.04, 24), waterMat);
  water.position.y = 0.35;
  group.add(water);

  // ---- Central pedestal: 0.4 m wide, rising to 1.3 m ----
  const pedPts = [
    new THREE.Vector2(0.30, 0.10),
    new THREE.Vector2(0.32, 0.16),
    new THREE.Vector2(0.22, 0.24),
    new THREE.Vector2(0.20, 0.45),
    new THREE.Vector2(0.16, 0.60),
    new THREE.Vector2(0.16, 1.00),
    new THREE.Vector2(0.20, 1.12),
    new THREE.Vector2(0.24, 1.22),
    new THREE.Vector2(0.20, 1.30),
  ];
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pedPts, 12), stoneMat);
  group.add(pedestal);

  // ---- Upper bowl: 0.9 m across, at y = 1.2 ----
  const bowlPts = [
    new THREE.Vector2(0.10, 1.16),
    new THREE.Vector2(0.30, 1.14),
    new THREE.Vector2(0.44, 1.18),
    new THREE.Vector2(0.45, 1.24),   // outer lip
    new THREE.Vector2(0.42, 1.26),   // lip top
    new THREE.Vector2(0.38, 1.24),   // inner lip
    new THREE.Vector2(0.30, 1.20),
    new THREE.Vector2(0.10, 1.19),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 16), stoneMat);
  group.add(bowl);

  // Upper bowl water
  const waterTop = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 16), waterMat);
  waterTop.position.y = 1.225;
  group.add(waterTop);

  // ---- Finial spout at y = 1.55 ----
  let finial;
  if (variant % 3 === 1) {
    // Pinecone-ish finial
    finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10), stoneDark);
    finial.position.y = 1.46;
  } else if (variant % 3 === 2) {
    // Ball finial
    finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), stoneDark);
    finial.position.y = 1.48;
  } else {
    // Classic pointed finial
    const fPts = [
      new THREE.Vector2(0.07, 1.30),
      new THREE.Vector2(0.09, 1.36),
      new THREE.Vector2(0.05, 1.44),
      new THREE.Vector2(0.055, 1.50),
      new THREE.Vector2(0.0, 1.58),
    ];
    finial = new THREE.Mesh(new THREE.LatheGeometry(fPts, 10), stoneDark);
  }
  group.add(finial);

  // Spout column under finial
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 8), stoneMat);
  spout.position.y = 1.36;
  group.add(spout);

  // Falling water streams (thin cylinders) — animated bobbing
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x7ab8c8, roughness: 0.2, transparent: true, opacity: 0.6
  });
  const streams = [];
  const nStreams = 4;
  for (let i = 0; i < nStreams; i++) {
    const a = (i / nStreams) * Math.PI * 2 + Math.PI / 4;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.82, 6), streamMat);
    s.position.set(Math.cos(a) * 0.40, 0.82, Math.sin(a) * 0.40);
    group.add(s);
    streams.push(s);
  }
  // Central spout jet
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.24, 6), streamMat);
  jet.position.y = 1.44;
  group.add(jet);

  // Animation: gentle water shimmer / stream pulse (visible travel)
  group.userData.update = (t) => {
    const p = Math.sin(t * 2.2) * 0.5 + 0.5;
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      s.scale.y = 0.9 + 0.2 * Math.sin(t * 3 + i * 1.7);
      s.position.y = 0.82 + 0.03 * Math.sin(t * 3 + i * 1.7);
    }
    jet.scale.y = 0.85 + 0.3 * p;
    waterTop.position.y = 1.225 + 0.008 * Math.sin(t * 2.2);
    water.position.y = 0.35 + 0.01 * Math.sin(t * 1.4);
  };

  group.userData.size = [2.40, 1.60, 2.40];
  return group;
}
