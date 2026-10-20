"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CuboidCollider,
  RigidBody,
  TrimeshCollider,
} from "@react-three/rapier";
import { Material, Mesh, Texture } from "three";
import { createScene } from "../worlds/courtyard/scene.js";
import { courtyardTriangles } from "../lib/courtyard-physics";

type Runtime = Awaited<ReturnType<typeof createScene>>;

function dispose(runtime: Runtime) {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  runtime.scene.traverse((object) => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    }
    const light = object as typeof object & {
      shadow?: { dispose: () => void };
    };
    light.shadow?.dispose();
  });
  for (const material of materials)
    for (const value of Object.values(material))
      if (value instanceof Texture) textures.add(value);
  if (runtime.scene.environment) textures.add(runtime.scene.environment);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

export function CourtyardGeometry({
  paused,
  reset,
  onReady,
  onError,
}: {
  paused: boolean;
  reset: number;
  onReady: () => void;
  onError: (error: unknown) => void;
}) {
  const { gl, scene } = useThree();
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    let cancelled = false;
    let owned: Runtime | null = null;
    void createScene({ renderer: gl })
      .then((result) => {
        if (cancelled) {
          dispose(result);
          return;
        }
        owned = result;
        result.update(0, 0);
        setRuntime(result);
      })
      .catch((error) => {
        if (!cancelled) onError(error);
      });
    return () => {
      cancelled = true;
      if (owned) dispose(owned);
    };
  }, [gl, onError]);
  useLayoutEffect(() => {
    if (!runtime) return;
    const previous = {
      background: scene.background,
      environment: scene.environment,
      fog: scene.fog,
    };
    scene.background = runtime.scene.background;
    scene.environment = runtime.scene.environment;
    scene.fog = runtime.scene.fog;
    return () => {
      Object.assign(scene, previous);
    };
  }, [runtime, scene]);
  useEffect(() => {
    if (runtime) onReady();
  }, [runtime, onReady]);
  useEffect(() => {
    elapsed.current = 0;
    runtime?.update(0, 0);
  }, [reset, runtime]);
  const triangles = useMemo(
    () => (runtime ? courtyardTriangles(runtime.scene) : null),
    [runtime]
  );
  useFrame((_, dt) => {
    if (paused || !runtime) return;
    elapsed.current += Math.min(dt, 0.1);
    runtime.update(elapsed.current, Math.min(dt, 0.1));
  });
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* A continuous floor avoids seams between the decorative paving pieces. */}
      <CuboidCollider args={[10.2, 0.1, 10.2]} position={[0, -0.1, 0]} />
      {runtime && <primitive object={runtime.scene} dispose={null} />}
      {triangles && <TrimeshCollider args={[triangles[0], triangles[1]]} />}
    </RigidBody>
  );
}
