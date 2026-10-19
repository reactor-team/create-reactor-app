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

// One cast-iron side frame: two legs, seat rail, tilted backrest posts, armrest.
function buildSideFrame(ironMat, backTilt) {
  const g = new THREE.Group();

  const legGeo = new THREE.BoxGeometry(0.05, 0.45, 0.06);
  const frontLeg = new THREE.Mesh(legGeo, ironMat);
  frontLeg.position.set(0, 0.225, 0.22);
  const backLeg = new THREE.Mesh(legGeo, ironMat);
  backLeg.position.set(0, 0.225, -0.22);
  g.add(frontLeg, backLeg);

  // feet
  const footGeo = new THREE.BoxGeometry(0.07, 0.03, 0.10);
  const f1 = new THREE.Mesh(footGeo, ironMat);
  f1.position.set(0, 0.015, 0.22);
  const f2 = new THREE.Mesh(footGeo, ironMat);
  f2.position.set(0, 0.015, -0.22);
  g.add(f1, f2);

  // seat rail connecting legs
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.56), ironMat);
  rail.position.set(0, 0.43, 0);
  g.add(rail);

  // backrest posts, tilted 10° back from vertical
  const postGeo = new THREE.BoxGeometry(0.05, 0.50, 0.05);
  const post = new THREE.Mesh(postGeo, ironMat);
  post.position.set(0, 0.66, -0.255);
  post.rotation.x = -backTilt;
  g.add(post);

  // armrest
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.56), ironMat);
  arm.position.set(0, 0.62, 0.02);
  arm.rotation.x = 0.06;
  g.add(arm);
  // armrest front support
  const armSup = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.045), ironMat);
  armSup.position.set(0, 0.53, 0.22);
  g.add(armSup);

  // decorative scroll (torus arc) between legs
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.018, 6, 14, Math.PI), ironMat);
  scroll.position.set(0, 0.30, 0);
  scroll.rotation.y = Math.PI / 2;
  g.add(scroll);

  return g;
}

export function buildBench(THREE, opts = {}) {
  const seed = (opts.seed !== undefined) ? opts.seed : 1;
  const variant = (opts.variant !== undefined) ? opts.variant : 0;
  const rand = mulberry32(seed * 1013 + variant * 77 + 5);

  const group = new THREE.Group();
  group.name = 'Bench';

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a, roughness: 0.6, metalness: 0.55,
  });

  const baseWood = new THREE.Color(0x8a5a30);
  if (opts.hue !== undefined) {
    baseWood.offsetHSL(opts.hue, 0, 0);
  } else if (opts.tint) {
    baseWood.lerp(new THREE.Color(opts.tint), 0.35);
  }

  const backTilt = THREE.MathUtils.degToRad(10);
  const length = 1.80;
  const slatLen = length - 0.12; // slats span between frames

  // ---- Seat: 5 planks, each 0.09 m wide, top at y=0.45 ----
  const seatSlatGeo = new THREE.BoxGeometry(slatLen, 0.03, 0.09);
  const gap = 0.02;
  const pitch = 0.09 + gap;
  const seatTopY = 0.45;
  const seatStartZ = -2 * pitch;
  for (let i = 0; i < 5; i++) {
    const c = baseWood.clone();
    c.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.0 });
    const slat = new THREE.Mesh(seatSlatGeo, m);
    slat.position.set(0, seatTopY - 0.015, seatStartZ + i * pitch);
    group.add(slat);
  }

  // ---- Backrest slats, tilted 10° ----
  const backSlatGeo = new THREE.BoxGeometry(slatLen, 0.09, 0.03);
  const nBack = variant === 1 ? 2 : 3; // variant changes silhouette
  const backBaseY = 0.56;
  const backBaseZ = -0.24;
  for (let i = 0; i < nBack; i++) {
    const c = baseWood.clone();
    c.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.0 });
    const slat = new THREE.Mesh(backSlatGeo, m);
    const y = backBaseY + i * 0.13;
    // tilt around X so top leans backward (-Z)
    slat.rotation.x = -backTilt;
    slat.position.set(0, y, backBaseZ - Math.tan(backTilt) * (y - seatTopY) - 0.02);
    group.add(slat);
  }

  // ---- Two cast-iron side frames ----
  const frameL = buildSideFrame(ironMat, backTilt);
  frameL.position.x = -(length / 2 - 0.06);
  const frameR = buildSideFrame(ironMat, backTilt);
  frameR.position.x = (length / 2 - 0.06);
  group.add(frameL, frameR);

  // ---- Under-seat stretcher bar for solidity ----
  const stretcher = new THREE.Mesh(
    new THREE.BoxGeometry(slatLen, 0.04, 0.04), ironMat);
  stretcher.position.set(0, 0.20, 0);
  group.add(stretcher);

  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  group.userData.size = [1.80, 0.90, 0.60];
  return group;
}
