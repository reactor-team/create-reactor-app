---
name: eden-live-own-game
description: Build a browser game and add it to the Eden Live starter as "your own game", streamed to EdenLive as client video. Use when asked to make a new game, world, or level for this app, or to stream any canvas game into EdenLive.
---

# Build your own game for EdenLive

EdenLive renders a playable game as a new world in real time. In this app,
**Your own game** mode runs a game in the browser, streams its canvas to the
model, and shows the rendered world large with your game in the corner. Your
game draws the layout and the motion; EdenLive supplies the look, from a
reference image and a prompt.

Your job as the agent: build the game the user describes and add it to this
app as a new world, next to the two that ship with it.

## How the shipped worlds work

The worked example is the **Steampunk plaza** and **Woodland camp** worlds: a
capsule character walks, runs, and jumps around a small scene in
[React Three Fiber](https://r3f.docs.pmnd.rs/) with Rapier physics.

| File | What it does |
| --- | --- |
| `app/lib/world.ts` | `LocalWorldId`, the canvas size and frame rate (1280x704 at 24 fps), each world's spawn point and camera anchor, and the movement rule. |
| `app/lib/world-examples.ts` | `LOCAL_WORLDS`: each world's title, one-line blurb, reference image, and prompt. The picker shows the reference image as the thumbnail. |
| `app/components/WorldScene.tsx` | The scene: player, camera, physics, and `Capture`, which copies every rendered frame to a fixed 1280x704 canvas. It picks the geometry by `worldId`. |
| `app/components/WorldGeometry.tsx` | `Platform`, the Woodland camp built from simple shapes with fixed colliders. Copy this shape for a new world. |
| `app/components/CourtyardGeometry.tsx` | The Steampunk plaza, loaded from a generated three.js scene in `app/worlds/courtyard/`. |
| `app/components/ThreeWorld.tsx` | Reads the keys, pauses and resets the scene, and publishes the capture canvas on `source_video`. You do not change this file to add a world. |
| `public/references/` | The reference image of each world. |

The app handles the rest: when the user picks a world it switches the source to
`client`, and stages the world's reference image and prompt. The world begins when the
user presses Start.

## Add a world

1. Add the id to `LocalWorldId` and its `spawn` and `camera` to `WORLD_SCENES`
   in `app/lib/world.ts`.
2. Build the geometry as a component, like `Platform`: simple meshes with
   `RigidBody type="fixed"` colliders for anything solid. Render it from
   `WorldScene` for your id. `WorldScene` adds the player once the scene is
   ready: start `sceneReady` as `true` for your id, as the campground does, or
   call `onReady` from the geometry, as the courtyard does.
3. Put the game's rules in the scene: goals, hazards, enemies, a win and a
   loss, and a restart. `reset` (a number that increases) restarts the round;
   `paused` stops it; `input` is the set of held keys (`w a s d`, the arrows,
   `shift`, `" "`).
4. Add a reference image to `public/references/` and an entry to
   `LOCAL_WORLDS` with a title, a one-line blurb, the image, and a prompt.
5. Run `pnpm typecheck`, `pnpm test`, and `pnpm dev`. Pick the new world in
   **Your own game**, play it in the corner, connect, and start a world.

For a game that is not a walking character (a vehicle, a board, a fixed
encounter), keep `Capture`, `paused`, `reset`, and `input` as they are and
replace `Player` and the camera with your own.

### The reference image

The reference image sets the look: style, palette, materials. **Save frame**
in the "Your game" panel downloads the exact frame your game sends. Restyle it
with any image tool, or use any image with the same layout, and save it to
`public/references/`. PNG, JPEG, or WebP, at most 25 MiB and 16 MP.

### The prompt

Describe the world as it should look, in the same order as the shipped
prompts: the camera and the player, the layout, the style, then what to keep
("keep the same character at the draft's position and scale, follow the scene
layout and camera movement"). End with "No text or HUD." The prompt can be
edited live; edits blend in over a few seconds.

## Design a game that renders well

These rules are adapted from EdenLive's own game skill,
[`game-prototype-turbo`](https://github.com/VAST-AI-Research/EdenLive/tree/main/realtime/skills/game-prototype-turbo),
which has the full workflow and a library of three.js modules for larger games.

- **One bounded round.** The player can reach a win and a loss, and restart
  returns to the opening state in the same page. Waves or a boss inside the
  round are fine; a menu of levels is not.
- **Keyboard only, or keyboard and mouse.** No gamepad, touch, camera, or sound
  as the core control. EdenLive ignores `set_keys` and `set_look` in this
  mode; your game reads its own input.
- **Greybox, and let EdenLive paint it.** Build from boxes, cylinders,
  spheres, and planes. Give each role (player, enemies, hazards, pickups, goal)
  a clear silhouette and its own flat color. A floor, a few large masses, and
  one landmark read better than many small props. Do not import detailed
  models.
- **A stable camera.** First person or a steady follow camera. Avoid cuts and
  fast shakes; each cut reads as a new scene.
- **Visible actions.** A swing, a flash, an enemy rearing before it attacks.
  An effect that lasts one frame can be lost in the output.
- **The HUD outside the canvas.** Show health, score, and the result in HTML
  over or beside the scene. Text inside the canvas is restyled with the rest.
- **A steady frame rate.** Keep frames cheap. The output plays at the rate the
  game sends, and browsers slow down hidden tabs.
- **Tell the world what happened.** EdenLive sees only frames. For a lasting
  change ("the gate opens"), also call `set_prompt`; it applies from the next
  chunk.

## What EdenLive expects from the stream

- Frames are scaled to cover 1280x704 and center-cropped. Draw at 1280x704.
- A steady 10 to 60 fps from `canvas.captureStream(fps)`.
- Call `set_source("client")` before `set_image` (in game mode `set_image`
  needs a game first), then `set_prompt` and `start`. Every command replies
  with `state_update`, or resolves `undefined` when refused; send it through
  `sendCommand` in `app/lib/model.ts` to get that call's reason.
- `game_state`, `health`, `outcome`, and `events` stay empty in this mode.

In another app, the same path takes a canvas and the typed SDK
`@reactor-models/eden-live`:

```tsx
const [track] = canvas.captureStream(30).getVideoTracks();
await publish("source_video", track);
await setSource({ source: "client" });
await setImage({ image: await uploadFile(referenceFile) });
await setPrompt({ prompt });
await start({});
```

## Checklist

- Win and loss are reachable, and restart works in the same page.
- The scene is simple shapes with one flat color per role.
- The game renders at 1280x704 and the HUD is outside the canvas.
- The world has a reference image and a prompt in `LOCAL_WORLDS`.
- `pnpm typecheck` and `pnpm test` pass, and the world plays in the app.

## Credit

The design rules are adapted from `game-prototype-turbo` in
[EdenLive](https://github.com/VAST-AI-Research/EdenLive), Copyright (c) 2026
Vast AI, licensed under the
[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0),
shortened and rewritten for this app.
