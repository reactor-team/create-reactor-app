import * as THREE from 'three';
import { mulberry32 } from './lib/noise.js';

// Plan: late afternoon sun, azimuth 300° (0 = +X, 90 = +Z), elevation 35°.
export const SUN_AZIMUTH_DEG = 300;
const SUN_ELEVATION_DEG = 35;

// Flat stone courtyard: the whole walkable surface is y = 0.
export function heightAt(x, z) { return 0; }

function sunDirection() {
  const az = THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG);
  const el = THREE.MathUtils.degToRad(SUN_ELEVATION_DEG);
  return new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az)
  ).normalize();
}

// Procedural paving texture: 2x2 m slabs over the 20x20 m courtyard,
// slab tones varying between 0x8f8a80 and 0xa5a095 over base 0x9a948a.
function makePavingTexture(THREE) {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const g = canvas.getContext('2d');
  const rand = mulberry32(20240817);
  g.fillStyle = '#6e6a62'; // recessed joint colour
  g.fillRect(0, 0, SIZE, SIZE);
  const slabs = 10; // 10 x 10 slabs of 2 m over 20 m
  const cell = SIZE / slabs;
  const lo = new THREE.Color(0x8f8a80);
  const hi = new THREE.Color(0xa5a095);
  const c = new THREE.Color();
  for (let i = 0; i < slabs; i++) {
    for (let j = 0; j < slabs; j++) {
      c.copy(lo).lerp(hi, rand());
      // slight per-slab brightness jitter
      const v = 0.94 + rand() * 0.10;
      g.fillStyle = `rgb(${Math.min(255, c.r * 255 * v) | 0},${Math.min(255, c.g * 255 * v) | 0},${Math.min(255, c.b * 255 * v) | 0})`;
      const inset = 1.5 + rand() * 1.5;
      g.fillRect(i * cell + inset, j * cell + inset, cell - inset * 2, cell - inset * 2);
      // worn mottling
      for (let k = 0; k < 6; k++) {
        g.fillStyle = `rgba(60,56,50,${0.03 + rand() * 0.05})`;
        const px = i * cell + rand() * cell;
        const py = j * cell + rand() * cell;
        g.beginPath(); g.arc(px, py, 2 + rand() * 6, 0, Math.PI * 2); g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Gradient sky dome (late afternoon, warm horizon toward the sun).
function makeSkyDome(THREE, sunDir) {
  const geo = new THREE.SphereGeometry(320, 32, 20);
  const mat = new THREE.ShaderMaterial({
    name: 'SkyDomeMat',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x6f9fd0) },
      uHorizon: { value: new THREE.Color(0xe8d9b8) },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(0xffe0b0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.62));
        float s = max(dot(normalize(vDir), uSunDir), 0.0);
        col += uSunColor * (pow(s, 220.0) * 0.9 + pow(s, 10.0) * 0.16);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'SkyDome';
  dome.raycast = () => {};
  return dome;
}

// Environment map baked from a tiny gradient scene (upright, warm low sun side).
function makeEnvTexture(THREE, renderer, sunDir) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uZenith: { value: new THREE.Color(0x6f9fd0) },
      uHorizon: { value: new THREE.Color(0xd8cba8) },
      uGround: { value: new THREE.Color(0x8a7a5a) },
      uSunDir: { value: sunDir.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = d.y >= 0.0
          ? mix(uHorizon, uZenith, pow(d.y, 0.6))
          : mix(uHorizon, uGround, pow(-d.y, 0.5));
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.85, 0.6) * pow(s, 60.0) * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(geo, mat));
  const tex = pmrem.fromScene(envScene, 0.05).texture;
  pmrem.dispose();
  geo.dispose(); mat.dispose();
  return tex;
}

function buildWalls(THREE) {
  const group = new THREE.Group();
  group.name = 'CourtyardWalls';
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa89880, roughness: 0.92, metalness: 0.0 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8f8070, roughness: 0.9, metalness: 0.0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8, metalness: 0.0 });

  const H = 3.0, T = 0.45, HALF = 10;
  const rand = mulberry32(77);

  function wallRun(len) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, H, T), stoneMat);
    body.position.y = H / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, T + 0.18), trimMat);
    cap.position.y = H + 0.08;
    cap.castShadow = true; cap.receiveShadow = true;
    g.add(cap);
    // subtle pilaster strips so the wall is not one flat band
    const n = Math.max(2, Math.round(len / 4));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, H, T + 0.1), trimMat);
      p.position.set(-len / 2 + (len * i) / n, H / 2, 0);
      p.castShadow = true; p.receiveShadow = true;
      g.add(p);
    }
    return g;
  }

  // North wall (z = -10), full width.
  const north = wallRun(HALF * 2 + T);
  north.position.set(0, 0, -HALF);
  group.add(north);
  // East / West walls.
  const east = wallRun(HALF * 2 + T);
  east.rotation.y = Math.PI / 2;
  east.position.set(HALF, 0, 0);
  group.add(east);
  const west = wallRun(HALF * 2 + T);
  west.rotation.y = Math.PI / 2;
  west.position.set(-HALF, 0, 0);
  group.add(west);

  // South wall (z = +10) with a 2.2 m arched wooden gate opening, centred.
  const gateW = 2.2;
  const sideLen = (HALF * 2 + T - gateW) / 2;
  const southL = wallRun(sideLen);
  southL.position.set(-(gateW / 2 + sideLen / 2), 0, HALF);
  group.add(southL);
  const southR = wallRun(sideLen);
  southR.position.set(gateW / 2 + sideLen / 2, 0, HALF);
  group.add(southR);
  // Lintel above the arch.
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(gateW + 0.4, H - 2.1 + 0.16, T), stoneMat);
  lintel.position.set(0, 2.1 + (H - 2.1) / 2 + 0.08, HALF);
  lintel.castShadow = true; lintel.receiveShadow = true;
  group.add(lintel);
  // Arch ring over the gate.
  const arch = new THREE.Mesh(new THREE.TorusGeometry(gateW / 2 + 0.1, 0.14, 8, 20, Math.PI), trimMat);
  arch.position.set(0, 2.1, HALF);
  arch.castShadow = true;
  group.add(arch);
  // Wooden gate doors (closed), slightly recessed into the wall.
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(gateW / 2 - 0.03, 2.05, 0.08), woodMat);
  doorL.position.set(-gateW / 4, 1.025, HALF);
  doorL.castShadow = true; doorL.receiveShadow = true;
  group.add(doorL);
  const doorR = doorL.clone();
  doorR.position.x = gateW / 4;
  group.add(doorR);
  // Gate planks detail: vertical battens.
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.03), trimMat);
    b.position.set(-gateW / 2 + 0.2 + (i * (gateW - 0.4)) / 5, 1.0, HALF - 0.06);
    group.add(b);
  }
  void rand;
  return group;
}

// Soft tree-tops and haze beyond the walls so no camera sees the world end.
function buildOutskirts(THREE) {
  const g = new THREE.Group();
  g.name = 'SkyOutskirts';
  const rand = mulberry32(913);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f7233, roughness: 0.95, metalness: 0.0 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x5f8038, roughness: 0.95, metalness: 0.0 });
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  // Uneven scatter of canopy blobs outside the walls (varied size/spacing: not a stamped ring).
  const count = 26;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rand() * 0.3;
    const r = 16 + rand() * 16;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const s = 2.2 + rand() * 3.4;
    const m = new THREE.Mesh(blobGeo, rand() > 0.5 ? leafMat : leafMat2);
    m.position.set(x, 2.2 + rand() * 2.4, z);
    m.scale.set(s, s * (0.55 + rand() * 0.3), s);
    m.rotation.y = rand() * Math.PI;
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
  }
  return g;
}

export function buildEnv(ctx) {
  const { THREE, scene, renderer } = ctx;
  const sunDir = sunDirection();

  // --- Atmosphere ---
  scene.fog = new THREE.Fog(0xd8e0e8, 40, 120);
  scene.background = new THREE.Color(0xcfd9e2);

  const sky = makeSkyDome(THREE, sunDir);
  scene.add(sky);

  scene.environment = makeEnvTexture(THREE, renderer, sunDir);

  // --- Light: warm late-afternoon key + cool sky / warm ground hemisphere fill ---
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
  sun.position.copy(sunDir).multiplyScalar(45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.HemisphereLight(0xbcd4e8, 0x8a7a5a, 0.55);
  scene.add(fill);

  // --- Ground: stone paving inside the walls, soft ground continuing outside ---
  const groundGroup = new THREE.Group();
  groundGroup.name = 'Ground';

  const pavingTex = makePavingTexture(THREE);
  const pavingMat = new THREE.MeshStandardMaterial({
    map: pavingTex, color: 0xffffff, roughness: 0.9, metalness: 0.0,
  });
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(20.4, 20.4), pavingMat);
  paving.name = 'GroundPaving';
  paving.rotation.x = -Math.PI / 2;
  paving.position.y = 0.001;
  paving.receiveShadow = true;
  groundGroup.add(paving);

  // Outer ground continues well past the fog-near so no edge meets the sky.
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x7d7a5c, roughness: 1.0, metalness: 0.0 });
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), outerMat);
  outer.name = 'GroundOuter';
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.01;
  outer.receiveShadow = true;
  groundGroup.add(outer);
  scene.add(groundGroup);

  // Grass strips along the inner wall edges.
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 0.95, metalness: 0.0 });
  const stripGeo = new THREE.BoxGeometry(19.2, 0.06, 0.9);
  const strips = [
    [0, -9.4, 0], [0, 9.4, 0],
  ];
  for (const [x, z] of strips) {
    const s = new THREE.Mesh(stripGeo, grassMat);
    s.position.set(x, 0.03, z);
    s.receiveShadow = true;
    groundGroup.add(s);
  }
  const stripGeoSide = new THREE.BoxGeometry(0.9, 0.06, 19.2);
  for (const [x, z] of [[-9.4, 0], [9.4, 0]]) {
    const s = new THREE.Mesh(stripGeoSide, grassMat);
    s.position.set(x, 0.03, z);
    s.receiveShadow = true;
    groundGroup.add(s);
  }

  // --- Enclosure and the world beyond ---
  scene.add(buildWalls(THREE));
  scene.add(buildOutskirts(THREE));

  // Nothing in the env animates; zones own fountain water, spray and leaf sway.
  return {
    sunDir,
    update(t, dt) { void t; void dt; },
  };
}
