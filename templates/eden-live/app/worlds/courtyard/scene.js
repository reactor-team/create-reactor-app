// src/scene.js — ASSEMBLED BY THE HARNESS (codeverse3d assembler). Edit zones/env instead; re-assembly overwrites this file.
import * as THREE from 'three';
import { buildEnv, heightAt } from './env.js';
import { build as buildCorners } from './zones/corners.js';
import { build as buildCourtCentre } from './zones/court_centre.js';

export async function createScene({ renderer, loaders }) {
  const scene = new THREE.Scene();
  const ctx = { THREE, scene, renderer, loaders, heightAt: heightAt, assets: {} };

  const env = (await buildEnv(ctx)) || {};
  ctx.env = env;

  const zones = [];
  const addZone = async (build, name) => {
    const g = await build(ctx);
    if (!g || !g.isObject3D) throw new Error(`zone ${name}: build(ctx) must return a THREE.Group`);
    if (!g.name) g.name = name;
    g.userData['c3d_zone'] = name;   // the harness's zone mark: the placement table measures its children
    scene.add(g);
    zones.push(g);
  };
  await addZone(buildCorners, 'Corners');
  await addZone(buildCourtCentre, 'CourtCentre');

  // a placed GLB clone that carries clips (a keyframed Blender part; `.clone()` copies them)
  // plays them here, driven by ABSOLUTE time so t=0 / t=1.5 are deterministic frames; a zone
  // de-phases copies with `clone.userData.clipOffset` (seconds).  Measured 2026-09-07: told
  // how to play a clip itself, the windmill zone placed the clone and played nothing.
  const players = [];
  scene.traverse((o) => {
    if (!o.animations || !o.animations.length) return;
    const mixer = new THREE.AnimationMixer(o);
    for (const clip of o.animations) mixer.clipAction(clip).play();
    players.push([mixer, +(o.userData.clipOffset || 0)]);
  });

  const cameras = [
    { name: 'overview', position: [8, 6.5, 8], lookAt: [0, 0.8, 0], fov: 50 },
    { name: 'eye_level', position: [0, 1.6, 8.5], lookAt: [0, 1, 0], fov: 55 },
  ];

  function update(t, dt) {
    if (env.update) env.update(t, dt);
    for (const z of zones) if (z.userData.update) z.userData.update(t, dt);
    for (const [mixer, offset] of players) mixer.setTime(t + offset);
  }
  return { scene, cameras, update };
}
