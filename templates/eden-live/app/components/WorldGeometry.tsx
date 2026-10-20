"use client";

import {
  Box,
  Capsule,
  Cone,
  Cylinder,
  Dodecahedron,
  Sphere,
} from "@react-three/drei";
import { CuboidCollider, MeshCollider, RigidBody } from "@react-three/rapier";

// Edit the scene directly with Drei primitives. Positions and dimensions are
// world units. Rapier hulls follow each solid mesh; the fence stays continuous.
export function Platform() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[11, 0.5, 11]} position={[0, -0.5, 0]} />
      <Box args={[22, 1, 22]} receiveShadow position={[0, -0.5, 0]}>
        <meshStandardMaterial color="#bcc8c0" roughness={0.95} />
      </Box>
      <gridHelper
        args={[22, 22, "#819792", "#a9b9b1"]}
        position={[0, 0.008, 0]}
      />

      {/* Four continuous fence colliders close the corners as well as the rails. */}
      {[
        [0, -10.25, 0],
        [0, 10.25, 0],
        [-10.25, 0, Math.PI / 2],
        [10.25, 0, Math.PI / 2],
      ].map(([x, z, angle], index) => (
        <group key={index} position={[x, 0, z]} rotation={[0, angle, 0]}>
          <CuboidCollider args={[10.4, 0.95, 0.15]} position={[0, 0.95, 0]} />
          {[-10.25, -6.15, -2.05, 2.05, 6.15, 10.25].map((post) => (
            <Box
              key={post}
              args={[0.3, 1.9, 0.3]}
              position={[post, 0.95, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#936e4c" roughness={0.9} />
            </Box>
          ))}
          {[0.6, 1.4].map((y) => (
            <Box
              key={y}
              args={[20.5, 0.18, 0.2]}
              position={[0, y, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#bc9569" roughness={0.9} />
            </Box>
          ))}
        </group>
      ))}

      <MeshCollider type="hull">
        {/* A loose ring of pines, with varied heights and open walking routes. */}
        {[
          [-8, -7, 1.3],
          [-4.8, -8, 1.5],
          [-0.8, -8.2, 1.15],
          [7.8, -7.7, 1.35],
          [-8.3, -2, 1.05],
          [8.2, -1.7, 1.2],
          [-8.1, 4.5, 1.35],
          [8, 5.4, 1.05],
          [-7.4, 8, 1.1],
          [7.4, 8.1, 1.25],
        ].map(([x, z, size], index) => (
          <group key={index} position={[x, 0, z]} scale={size}>
            <Cylinder
              args={[0.23, 0.32, 2, 6]}
              position={[0, 1, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#806044" flatShading />
            </Cylinder>
            <Cone
              args={[1.45, 2.8, 6]}
              position={[0, 2.5, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={index % 2 ? "#456b53" : "#557c57"}
                flatShading
              />
            </Cone>
            <Cone
              args={[1.05, 2.3, 6]}
              position={[0, 3.7, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={index % 2 ? "#66896a" : "#76956a"}
                flatShading
              />
            </Cone>
          </group>
        ))}

        {/* Clumps of bushes tuck into the edges instead of blocking the campsite. */}
        {[
          [-6.5, -5, 1],
          [-3, -7, 0.85],
          [7.2, -3.5, 0.8],
          [-7.3, 1.6, 1.1],
          [7.4, 2.2, 0.95],
          [-3.5, 7.6, 0.85],
          [2, 8, 1],
        ].map(([x, z, size], index) => (
          <group key={index} position={[x, 0, z]} scale={size}>
            <Sphere
              args={[0.75, 8, 6]}
              position={[-0.4, 0.6, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#7f9d59" flatShading />
            </Sphere>
            <Sphere
              args={[0.9, 8, 6]}
              position={[0.2, 0.8, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#9aad6b" flatShading />
            </Sphere>
          </group>
        ))}

        {/* Faceted rocks, each with a simple gameplay collider. */}
        {[
          [-5.4, -4.5, 1.1],
          [3.2, -7.6, 0.9],
          [7, 0.5, 0.65],
          [-6.8, 6.8, 0.8],
          [5.8, 7.2, 1.15],
          [-7, -0.3, 0.55],
        ].map(([x, z, size], index) => (
          <group key={index} position={[x, 0, z]} scale={size}>
            <Dodecahedron
              args={[1.1, 0]}
              position={[0, 0.75, 0]}
              scale={[1.2, 0.9, 1]}
              rotation={[0, index * 0.7, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={index % 2 ? "#8a9291" : "#78838a"}
                roughness={1}
                flatShading
              />
            </Dodecahedron>
          </group>
        ))}
      </MeshCollider>

      {/* Campfire: a stone ring, crossed logs and simple emissive cones. */}
      <group position={[0, 0, -2.3]}>
        <MeshCollider type="hull">
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index * Math.PI) / 6;
            return (
              <Dodecahedron
                key={index}
                args={[0.22, 0]}
                position={[Math.cos(angle) * 0.9, 0.16, Math.sin(angle) * 0.9]}
                scale={[1, 0.7, 0.85]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color="#7c7c73"
                  roughness={1}
                  flatShading
                />
              </Dodecahedron>
            );
          })}
          <Cylinder
            args={[0.14, 0.17, 1.5, 6]}
            position={[0, 0.17, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <meshStandardMaterial color="#60422d" />
          </Cylinder>
          <Cylinder
            args={[0.14, 0.17, 1.5, 6]}
            position={[0, 0.28, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <meshStandardMaterial color="#765035" />
          </Cylinder>
        </MeshCollider>
        <Cone args={[0.45, 1.2, 6]} position={[0, 0.85, 0]}>
          <meshStandardMaterial
            color="#ed783b"
            emissive="#e5571e"
            emissiveIntensity={0.8}
            flatShading
          />
        </Cone>
        <Cone args={[0.26, 0.9, 5]} position={[0.08, 0.78, 0.15]}>
          <meshStandardMaterial
            color="#ffe4a0"
            emissive="#ffc15a"
            emissiveIntensity={1.2}
            flatShading
          />
        </Cone>
        <pointLight
          position={[0, 1.1, 0]}
          color="#ffae65"
          intensity={4}
          distance={6}
        />
      </group>

      <MeshCollider type="hull">
        {/* Two benches face the fire; seats and feet are plain boxes. */}
        {[-2.7, 2.7].map((x) => (
          <group key={x} position={[x, 0, -2.3]} rotation={[0, Math.PI / 2, 0]}>
            <Box
              args={[3, 0.18, 0.7]}
              position={[0, 0.8, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#a17a4e" roughness={0.9} />
            </Box>
            {[-1, 1].map((leg) => (
              <Box
                key={leg}
                args={[0.22, 0.7, 0.55]}
                position={[leg, 0.35, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial color="#72573f" roughness={0.9} />
              </Box>
            ))}
          </group>
        ))}

        {/* Open A-frame tent: two sloping canvas panels and a ground mat. */}
        <group position={[5.3, 0, -5.2]} rotation={[0, -0.2, 0]}>
          <Box args={[3.4, 0.08, 3.4]} position={[0, 0.05, 0]} receiveShadow>
            <meshStandardMaterial color="#786c51" roughness={1} />
          </Box>
          {[-1, 1].map((side) => (
            <Box
              key={side}
              args={[2.8, 0.08, 3.4]}
              position={[side * 0.85, 1.15, 0]}
              rotation={[0, 0, -side * Math.atan2(2.2, 1.7)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={side < 0 ? "#c69b59" : "#d5b675"}
                roughness={1}
              />
            </Box>
          ))}
          <Box args={[0.07, 2.3, 0.07]} position={[0, 1.15, 1.6]} castShadow>
            <meshStandardMaterial color="#72573f" />
          </Box>
          <Box args={[0.9, 0.16, 2.1]} position={[0.45, 0.17, 0]}>
            <meshStandardMaterial color="#718b82" roughness={1} />
          </Box>
        </group>
      </MeshCollider>
    </RigidBody>
  );
}

export function CapsuleVisual() {
  return (
    <group>
      <Capsule args={[0.35, 1.1, 8, 16]} castShadow>
        <meshStandardMaterial color="#f3a34b" roughness={0.55} />
      </Capsule>
      <Sphere
        args={[0.16, 16, 8]}
        position={[0, 0.12, 0.32]}
        scale={[1.4, 0.62, 0.14]}
      >
        <meshStandardMaterial color="#263238" roughness={0.4} />
      </Sphere>
    </group>
  );
}
