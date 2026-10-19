---
name: eden-live
description: Extend the Eden Live starter built on @reactor-models/eden-live. Covers its two modes (built-in games the model runs, and your own browser game streamed as client video), the commands, state, controls, and auth.
---

# Eden Live extension guide

You have cloned this folder and want to build on it. EdenLive turns a playable
game into a generated world in real time. It returns two frame-paired video
tracks: `main_video`, the generated world, and `draft_video`, the game it was
generated from.

The app has two modes, switched at the top of the sidebar:

- **Built-in games.** The model runs one of seven games and the client steers
  it with keys and mouse look (`set_source("game")`).
- **Your own game.** A game runs in this page, drawn with React Three Fiber, and
  its canvas is published on `source_video` (`set_source("client")`). Two worlds
  ship with the app. The "+" tile in the game picker hands the user's coding
  agent [`own-game.md`](own-game.md), which says how to build and add another.

Both modes use the same stage: the generated world large, the draft as a small
picture-in-picture in the corner (the `draft_video` track for built-in games,
the local scene itself for your own game).

This template imports the typed SDK
`@reactor-models/eden-live` (2.1.0) only through `app/lib/model.ts`; keep it
that way, so a version change touches one file.

## The four concepts

| Concept | API | In this app |
| --- | --- | --- |
| Connection | `useEdenLive()`: `status`, `connect`, `disconnect` | Explicit Connect and Disconnect in the sidebar. |
| Commands | Typed methods on `useEdenLive()` | `selectGame`, `setSource`, `setImage`, `setPrompt`, `start`, `setPaused`, `setKeys`, `setLook`. |
| Messages | `useEdenLiveStateUpdate` | One message, `state_update`, the full snapshot. Every command also replies with it. |
| Tracks | `ReactorView` for `main_video` / `draft_video`; `publish("source_video", track)` | The world fills the stage; the draft is the inset. Your own game publishes its canvas. |

## Code layout

| File | Role |
| --- | --- |
| `app/components/Playground.tsx` | Owns the mode, the snapshot, the prompt draft, the command helper, and the layout. |
| `app/components/Stage.tsx` | The world video with the draft inset, status badge, health overlay, outcome card, loss tint, and the focus/pointer surface. |
| `app/components/Picker.tsx` | A grid of thumbnails, used for the games and the local worlds, with the optional "+" tile. |
| `app/components/AddGameDialog.tsx` | The "+" dialog. Copies `skill/own-game.md`, served by `app/api/own-game-skill/route.ts`. |
| `app/components/PromptBar.tsx` | The scene prompt, edited in place; Enter applies it. |
| `app/components/ControlMap.tsx` | A keyboard (and mouse, for built-in games) that lights up held inputs; caps also take a pointer press. |
| `app/components/ThreeWorld.tsx` | Your own game: reads keys, pauses and resets the scene, and publishes its capture canvas. |
| `app/components/WorldScene.tsx`, `WorldGeometry.tsx`, `CourtyardGeometry.tsx` | The local scene: player, camera, physics, geometry, and the 1280x704 capture. |
| `app/lib/useGameInput.ts` | Built-in games: keyboard and pointer-lock mouse look, sent with the senders in `input.ts`. |
| `app/lib/input.ts` | Pure logic: key and look senders, motion-to-look mapping, image limits. Tested in `tests/`. |
| `app/lib/games.ts` | Title, blurb, and per-key action labels for each built-in game. |
| `app/lib/world.ts`, `app/lib/world-examples.ts` | The local worlds: ids, spawn and camera, movement, reference images, and prompts. |
| `app/lib/model.ts` | The only import of `@reactor-models/eden-live`, plus `GAMES`, the app's type names, and `useReactorClient`. |

## UI phases

| Phase | Snapshot | What the user does |
| --- | --- | --- |
| Offline | none (`status !== "ready"`) | Connect. In own-game mode the local world already plays in the inset. |
| Preview | `started: false` | Pick a game or world. The world shows the staged reference. Edit the prompt, upload an image, Start. |
| Live | `started && !paused && !ended` | Play, edit the prompt, Pause, Start new world. |
| Paused | `started && paused && !ended` | Resume, pick another game or world, upload an image. |
| Ended | `ended: true` | Built-in games only: the outcome card shows. Start new world or pick another game. |

Gate every control on `status === "ready"` as well as the snapshot, and clear
the snapshot when the status leaves `ready`. Otherwise a stale snapshot from the
last session drives the UI after a reconnect.

## How each mode stages a world

| Mode | When the user picks | The app sends | Start needs |
| --- | --- | --- | --- |
| Built-in games | a game | `set_paused(true)` if a world plays, `select_game`, then `set_source("game")` if needed | `source: "game"` and a game |
| Your own game | a world (also right after connecting) | `set_paused(true)` if a world plays, `set_source("client")`, upload + `set_image`, `set_prompt` | `source: "client"`, a reference, and the canvas published |

`pauseFirst()` reads the state with an empty `set_keys` when no snapshot has
arrived yet; every command replies with the full state.

## Commands

All commands reply with `state_update`. Each call resolves with the reply, or
`undefined` when the model refused it.

| Command | Payload | When and what |
| --- | --- | --- |
| `select_game` | `game` | Paused only. Stages the game's opening scene as the reference and its prompt as `prompt`, and ends the world. Replies once the game is loaded (about 2 s). Fails `pause_required`. |
| `set_image` | uploaded file | Paused only. Uses the image as the reference, and ends the world. PNG, JPEG, or WebP, at most 25 MiB and 16 MP. Fails `pause_required`, `game_required` (game source without a game), `invalid_image`. |
| `set_source` | `game` or `client` | Where the draft comes from. Switches within a world. Fails `game_required` when a started world switches to `game` before `select_game`. |
| `start` | optional `seed` | A new world from the reference and the prompt; replaces a running one. Fails `game_required`, `image_required`, `prompt_required`. |
| `set_prompt` | nonblank `prompt` | Any time. Applies from the next chunk and keeps the visual history, so the look shifts gradually. Fails `prompt_required`. |
| `set_keys` | held keys | The keys held in a built-in game. Ignored while paused and with source `client`. |
| `set_look` | `yaw`, `pitch` in -1..1 | A held turn and tilt rate until replaced; `(0, 0)` stops it. Ignored while paused and with source `client`. |
| `set_paused` | `paused` | Pausing releases keys and look. Fails `start_required`, `game_ended` on resume. |

Games: `freeze`, `spiders`, `tracer`, `bioshock`, `godzilla`, `arcadeduel`,
`dust2`. Keys: `w a s d`, the four arrows, `f`, `" "` (space), `shift`, `e`,
`r`, `g`.

## Replies, state, and errors

Await each command and adopt its returned `StateUpdate`; `Playground.tsx` does
this in one `command()` helper. Do not read command results off the
subscription: a reply belongs to the connection that asked. Use
`useEdenLiveStateUpdate` for the snapshot the model broadcasts every chunk.

A refused call resolves `undefined` and never rejects. There is no
`command_error` message. Read the reason from
`useReactorClient().getLastError()`: its `code` is the model's code (for
example `pause_required`) and its message is the model's text. The app shows it
in the error banner, except for the errors a user's own Disconnect causes.

Snapshot fields: `source`, `game`, `image_name`, `prompt`, `seed`, `keys`,
`look`, `paused`, `started`, `ended`, `game_state` (`RUNNING`, `WON`, `LOST`,
or empty), `outcome` (result card lines), `health`, `health_max`, `events`
(sentences about the last chunk), `world_id`, `chunks`, `seconds`. `events`
repeats on every update until the next chunk, so log it once per new `chunks`.
With source `client`, `game_state`, `health`, `outcome`, and `events` are empty.

## Controls

**Built-in games.** `useGameInput` reads keys while the stage has focus and
takes pointer lock when the user clicks the stage. While locked, mouse speed
becomes a look rate (`lookFromMotion`), the left button holds `f` and the right
button holds `e`; Esc releases the lock. Two senders keep the commands correct:

- `createKeySender` sends the full held set, in order, so a late press never
  lands after its release.
- `createLookSender` keeps one `set_look` in flight and sends only the newest
  rate.

Both are cleared on blur, a hidden tab, pause, and disconnect, and `reset()`
drops anything still queued for a session that has ended.

**Your own game.** `ThreeWorld` reads keys on the page (outside text fields)
and moves the local player; nothing goes to the model but frames. The same
`ControlMap` shows the held keys, and its caps call the world's `press` and
`release`.

## Your own game

The local world renders at 1280x704 into a capture canvas, and `ThreeWorld`
publishes it with `canvas.captureStream(24)`. The model scales frames to cover
1280x704 and plays its output at the rate it receives, from 10 to 60 fps.
"Reset player" restarts the round; "Save frame" downloads the exact frame sent,
which is a good starting point for a new reference image.

To add a world, or to stream a game from another app, follow
[`own-game.md`](own-game.md). It is also what the "+" dialog copies, so keep it
self-contained and free of anything a user's agent cannot see.

## Not exposed in this app

| Knob | Typed method | Where it would go |
| --- | --- | --- |
| World seed | `start({ seed })` | Beside Start. The same seed, reference, and draft repeat a world. |
| Auto connect | `connectOptions={{ autoConnect: true }}` in `EdenLiveApp.tsx` | Off here so the connection lifecycle stays visible. |

## Auth

`app/api/reactor/token/route.ts` exchanges `REACTOR_API_KEY` for a JWT scoped to
`reactor/eden-live`, limited to 10 sessions and one hour, and returns
`{ jwt, expires_at }` with `Cache-Control: private, no-store`. The provider and
the route both use `REACTOR_API_URL` from `app/lib/config.ts`
(`NEXT_PUBLIC_REACTOR_API_URL` overrides it), because a token works only with
the API that minted it. `app/lib/token.ts` keeps one token in memory for the
whole session and shares one fetch between concurrent callers. A session can be
used only by the token that created it, so never refetch per call, never rely
on the browser cache, and never store the token. When it expires, disconnect and
connect again.

## Look and feel

Use the tokens from `@reactor-team/ui/styles.css`, not its components. The app
follows the other starters: compact header with the white Reactor mark, dark
zinc panels, small uppercase labels, and a 320px sidebar. Keep the world as the
largest element, with the draft inset in its corner and the controls directly
under it at full width. The sidebar holds the session, the mode switch, the
picker card (with the selected game's name, description, and Start / Pause),
and the scene prompt. Game status rides on the world as a thin overlay: health
in games that have it, the result card at the end, and a red tint on a loss.

## Checklist for a change

- Every control is gated on `status === "ready"` and the phase it needs.
- Every command is awaited, and an `undefined` reply shows the last error.
- Held inputs are released on blur, hidden tab, pause, and disconnect.
- Both modes still start a world, and switching mode while live pauses first.
- Disconnect, then connect again: no state from the old session remains.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
