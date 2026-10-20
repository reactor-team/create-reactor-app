import * as THREE from 'three';
import { buildFountain } from '../assets/fountain.js';
import { buildBench } from '../assets/bench.js';

// CourtCentre — fountain at the origin on a darker 6 m paving ring,
// benches east and west facing it, terracotta shrub pots flanking each bench.

function makeShrubPot(THREE, seed) {
  const g = new THREE.Group();
  g.name = 'ShrubPot';
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xb5654a, roughness: 0.9, metalness: 0 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1, metalness: 0 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.85, metalness: 0 });

  // tapered pot: rim radius 0.22, base 0.16, height 0.34
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 14), terracotta);
  pot.position.y = 0.17;
  pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 16), terracotta);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.34;
  rim.castShadow = true;
  g.add(rim);

  const soilDisc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), soil);
  soilDisc.rotation.x = -Math.PI / 2;
  soilDisc.position.y = 0.33;
  g.add(soilDisc);

  // clipped shrub: two slightly offset squashed spheres, hue varied by seed
  const hueShift = (seed % 3) * 0.03;
  const leafMat = leaf.clone();
  leafMat.color.offsetHSL(hueShift, 0, (seed % 2) * 0.03);
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), leafMat);
  s1.scale.set(1, 0.85, 1);
  s1.position.y = 0.52;
  s1.castShadow = true;
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat);
  s2.position.set(0.08, 0.66, 0.05);
  s2.castShadow = true;
  g.add(s1, s2);
  return g;
}

export function build(ctx) {
  const { THREE: T, heightAt } = ctx;
  const g = new THREE.Group();
  g.name = 'CourtCentre';
  const animated = [];

  // Darker paving ring, 6 m diameter, slightly proud of the courtyard paving.
  const ringMat = new T.MeshStandardMaterial({ color: 0x8a857a, roughness: 0.95, metalness: 0 });
  const ring = new T.Mesh(new T.CircleGeometry(3.0, 48), ringMat);
  ring.name = 'PavingRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.receiveShadow = true;
  g.add(ring);

  // Faint radial slab joints on the ring so it reads as slabs, not a disc.
  const jointMat = new T.MeshStandardMaterial({ color: 0x6e6a60, roughness: 1, metalness: 0 });
  const jointGeo = new T.BoxGeometry(0.02, 0.004, 2.9);
  const joints = new T.Group();
  joints.name = 'RingJoints';
  for (let i = 0; i < 12; i++) {
    const j = new T.Mesh(jointGeo, jointMat);
    const a = (i / 12) * Math.PI * 2;
    j.position.set(Math.sin(a) * 1.55, 0.014, Math.cos(a) * 1.55);
    j.rotation.y = a;
    joints.add(j);
  }
  g.add(joints);

  // Fountain at the origin, base at y=0, facing the south gate (+Z).
  const fountain = buildFountain(T, {});
  fountain.name = 'Fountain';
  fountain.position.set(0, heightAt ? heightAt(0, 0) : 0, 0);
  fountain.rotation.y = Math.PI; // azimuth 180
  fountain.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(fountain);
  if (fountain.userData && typeof fountain.userData.update === 'function') {
    animated.push(fountain);
  }

  // Benches east (x=4.5) and west (x=-4.5), facing the fountain.
  const benchE = buildBench(T, {});
  benchE.name = 'BenchEast';
  benchE.position.set(4.5, heightAt ? heightAt(4.5, 0) : 0, 0);
  benchE.rotation.y = -Math.PI / 2; // front (+Z) toward -X
  benchE.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(benchE);

  const benchW = buildBench(T, {});
  benchW.name = 'BenchWest';
  benchW.position.set(-4.5, heightAt ? heightAt(-4.5, 0) : 0, 0);
  benchW.rotation.y = Math.PI / 2; // front toward +X
  benchW.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(benchW);

  // Four terracotta shrub pots: two flanking each bench (along z).
  const potSpots = [
    [4.5, 1.3], [4.5, -1.3],
    [-4.5, 1.3], [-4.5, -1.3],
  ];
  potSpots.forEach(([x, z], i) => {
    const pot = makeShrubPot(T, i);
    pot.name = 'ShrubPot' + i;
    pot.position.set(x, heightAt ? heightAt(x, z) : 0, z);
    pot.rotation.y = i * 1.7;
    g.add(pot);
  });

  g.userData.update = (t, dt) => {
    for (const a of animated) a.userData.update(t, dt);
  };
  return g;
}
