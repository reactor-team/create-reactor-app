import type * as THREE from "three";

export function createScene({
  renderer,
  loaders,
}: {
  renderer: THREE.WebGLRenderer;
  loaders?: unknown;
}): Promise<{
  scene: THREE.Scene;
  cameras: {
    name: string;
    position: [number, number, number];
    lookAt: [number, number, number];
    fov: number;
  }[];
  update: (t: number, dt: number) => void;
}>;
