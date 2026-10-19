"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CapsuleCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Vector3 } from "three";
import { Platform, CapsuleVisual } from "./WorldGeometry";
import { CourtyardGeometry } from "./CourtyardGeometry";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_SCENES,
  worldMovement,
  type LocalWorldId,
} from "../lib/world";

type Input = RefObject<Set<string>>;
type PlayerData = { position: Vector3; grounded: boolean };

function Player({
  input,
  reset,
  data,
  worldId,
}: {
  input: Input;
  reset: number;
  data: RefObject<PlayerData>;
  worldId: LocalWorldId;
}) {
  const spawn = WORLD_SCENES[worldId].spawn;
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<Group>(null);
  const { world } = useRapier();
  const { camera } = useThree();
  const controller = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);
  const velocityY = useRef(0);
  const jumped = useRef(false);
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const up = useRef(new Vector3(0, 1, 0));
  // Dispose before Physics frees its world in passive-effect cleanup.
  useLayoutEffect(() => {
    const character = world.createCharacterController(0.02);
    character.enableSnapToGround(0.2);
    character.enableAutostep(0.3, 0.2, false);
    character.setMaxSlopeClimbAngle(Math.PI / 4);
    controller.current = character;
    return () => {
      controller.current = null;
      world.removeCharacterController(character);
    };
  }, [world]);
  useEffect(() => {
    const position = { x: spawn[0], y: spawn[1], z: spawn[2] };
    body.current?.setTranslation(position, true);
    body.current?.setNextKinematicTranslation(position);
    velocityY.current = 0;
    jumped.current = false;
    if (visual.current) visual.current.rotation.y = 0;
    data.current.position.set(...spawn);
    data.current.grounded = false;
  }, [reset, data, spawn]);
  useBeforePhysicsStep((physics) => {
    const rb = body.current,
      character = controller.current;
    if (!rb || !character || !rb.isValid()) return;
    const collider = rb.collider(0);
    if (!collider) return;
    const dt = physics.timestep;
    const keys = input.current;
    const movement = worldMovement(keys);
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(forward.current, up.current).normalize();
    desired.current
      .copy(forward.current)
      .multiplyScalar(movement.z)
      .addScaledVector(right.current, movement.x)
      .multiplyScalar(movement.speed * dt);
    const jump = keys.has(" ");
    if (jump && !jumped.current && data.current.grounded) velocityY.current = 6;
    jumped.current = jump;
    velocityY.current = Math.max(-25, velocityY.current - 18 * dt);
    desired.current.y = velocityY.current * dt;
    character.computeColliderMovement(
      collider,
      desired.current,
      undefined,
      undefined,
      (other) => other.parent()?.handle !== rb.handle
    );
    const corrected = character.computedMovement();
    data.current.grounded = character.computedGrounded();
    if (
      (data.current.grounded && velocityY.current < 0) ||
      (velocityY.current > 0 && corrected.y < desired.current.y - 0.001)
    )
      velocityY.current = 0;
    const position = rb.translation();
    if (position.y < -8) {
      const position = { x: spawn[0], y: spawn[1], z: spawn[2] };
      rb.setTranslation(position, true);
      rb.setNextKinematicTranslation(position);
      velocityY.current = 0;
      data.current.position.set(...spawn);
    } else {
      rb.setNextKinematicTranslation({
        x: position.x + corrected.x,
        y: position.y + corrected.y,
        z: position.z + corrected.z,
      });
      data.current.position.set(position.x, position.y, position.z);
    }
    if ((movement.x || movement.z) && visual.current)
      visual.current.rotation.y = Math.atan2(
        desired.current.x,
        desired.current.z
      );
  });
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[...spawn]}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.55, 0.35]} />
      <group ref={visual}>
        <CapsuleVisual />
      </group>
    </RigidBody>
  );
}

function WorldCamera({
  data,
  paused,
  reset,
  worldId,
}: {
  data: RefObject<PlayerData>;
  paused: boolean;
  reset: number;
  worldId: LocalWorldId;
}) {
  const anchor = WORLD_SCENES[worldId].camera;
  const { camera, gl } = useThree();
  const target = useRef(new Vector3(0, 1.35, 0));
  const zoom = useRef(1);
  const desired = useRef(new Vector3());
  useEffect(() => {
    const wheel = (event: WheelEvent) => {
      if (paused) return;
      event.preventDefault();
      zoom.current = Math.max(
        0.85,
        Math.min(1.15, zoom.current + event.deltaY * 0.0006)
      );
    };
    gl.domElement.addEventListener("wheel", wheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", wheel);
  }, [gl, paused]);
  useEffect(() => {
    zoom.current = 1;
    target.current.copy(data.current.position).add(new Vector3(0, 0.4, 0));
    camera.position.set(...anchor);
    camera.lookAt(target.current);
  }, [reset, camera, data, anchor]);
  useFrame((_, dt) => {
    if (paused) return;
    // An anchored camera gently pans toward the player; wheel zoom stays bounded.
    const blend = 1 - Math.exp(-2.5 * dt);
    desired.current.copy(data.current.position);
    desired.current.y += 0.4;
    target.current.lerp(desired.current, blend);
    desired.current.set(...anchor).multiplyScalar(zoom.current);
    camera.position.lerp(desired.current, blend);
    camera.lookAt(target.current);
  });
  return null;
}

function Capture({
  paused,
  onSurface,
  revision,
}: {
  paused: boolean;
  onSurface: (canvas: HTMLCanvasElement | null) => void;
  revision: string;
}) {
  const surface = useRef<HTMLCanvasElement | null>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const lastFrame = useRef(-Infinity);
  useEffect(() => {
    lastFrame.current = -Infinity;
  }, [revision]);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
    surface.current = canvas;
    context.current = canvas.getContext("2d", { alpha: false });
    if (!context.current)
      throw new Error("Canvas capture is unavailable in this browser.");
    lastFrame.current = -Infinity;
    // Surface is announced after its first rendered frame, never while blank.
    return () => {
      onSurface(null);
      surface.current = null;
      context.current = null;
    };
  }, [onSurface]);
  useFrame(({ gl, scene, camera, clock }) => {
    // Keep source quality stable when Compare becomes a small immersive inset.
    // R3F measures the visible viewport; the drawing buffer stays model-sized.
    if (
      gl.domElement.width !== WORLD_WIDTH ||
      gl.domElement.height !== WORLD_HEIGHT
    )
      gl.setSize(WORLD_WIDTH, WORLD_HEIGHT, false);
    gl.render(scene, camera);
    const time = clock.elapsedTime;
    if (
      (!paused || lastFrame.current === -Infinity) &&
      context.current &&
      surface.current
    ) {
      context.current.drawImage(gl.domElement, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      if (lastFrame.current === -Infinity) onSurface(surface.current);
      lastFrame.current = time;
    }
  }, 1);
  return null;
}

export function WorldScene({
  worldId,
  paused,
  reset,
  input,
  onSurface,
  onError,
}: {
  worldId: LocalWorldId;
  paused: boolean;
  reset: number;
  input: Input;
  onSurface: (canvas: HTMLCanvasElement | null) => void;
  onError: (error: unknown) => void;
}) {
  const [sceneReady, setSceneReady] = useState(worldId === "campground");
  const ready = useCallback(() => setSceneReady(true), []);
  const player = useRef<PlayerData>({
    position: new Vector3(...WORLD_SCENES[worldId].spawn),
    grounded: false,
  });
  return (
    <Canvas
      shadows
      dpr={1}
      camera={{
        position: [...WORLD_SCENES[worldId].camera],
        fov: 45,
        near: 0.1,
        far: 500,
      }}
      gl={{ antialias: true, alpha: false }}
      fallback={<p>Interactive 3D preview (requires WebGL).</p>}
    >
      {worldId === "campground" && (
        <>
          <color attach="background" args={["#9cb6c5"]} />
          <fog attach="fog" args={["#9cb6c5", 35, 80]} />
          <hemisphereLight args={["#e9f3ff", "#556051", 2.2]} />
          <directionalLight
            castShadow
            position={[5, 10, 4]}
            intensity={3}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-14}
            shadow-camera-right={14}
            shadow-camera-top={14}
            shadow-camera-bottom={-14}
            shadow-normalBias={0.04}
          />
        </>
      )}
      <Suspense fallback={null}>
        <Physics paused={paused} timeStep={1 / 60} interpolate>
          {worldId === "campground" ? (
            <Platform />
          ) : (
            <CourtyardGeometry
              paused={paused}
              reset={reset}
              onReady={ready}
              onError={onError}
            />
          )}
          {sceneReady && (
            <Player
              input={input}
              reset={reset}
              data={player}
              worldId={worldId}
            />
          )}
          {sceneReady && (
            <Capture
              paused={paused}
              onSurface={onSurface}
              revision={String(reset)}
            />
          )}
        </Physics>
      </Suspense>
      <WorldCamera
        data={player}
        paused={paused}
        reset={reset}
        worldId={worldId}
      />
    </Canvas>
  );
}
