---
name: extend-abot-world-halo
description: Extend this ABot World Halo game world using its typed commands, the state_update snapshot, held movement and actions, live scenes, video and sound.
---

# Extending the ABot World Halo game world

ABot World Halo streams an action game world with sound. A world starts from a
first frame, up to five views of the playable character and a scene
description, and runs with no length limit until `reset` or the client leaves.
Walking, turning, actions and the scene can all change while it plays; each
change applies from the next chunk (9 or 12 frames, about 0.43 s).

The typed SDK is `@reactor-models/abot-world-halo@1.9.0` on npm, on base SDK
`@reactor-team/js-sdk` `3.3.0`.

## Four concepts

| Concept    | API                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- |
| Connection | `AbotWorldHaloProvider`, `useAbotWorldHalo()` status/connect/disconnect/uploadFile/lastError |
| Commands   | `setFirstFrame`, `setReferences`, `setPrompt`, `setSeed`, `setResolution`, `setMove`, `setLook`, `setAction`, `setPaused`, `start`, `reset` |
| Messages   | `useAbotWorldHaloStateUpdate`, `useAbotWorldHaloChunkComplete`, `useAbotWorldHaloGenerationStarted`, `useAbotWorldHaloGenerationComplete` |
| Tracks     | `AbotWorldHaloMainVideoView`; `useAbotWorldHaloTrack("main_audio")` with an audio element      |

Every model import comes from `@reactor-models/abot-world-halo`. No camera or
microphone input is needed.

## States

```text
          start
  idle ───────────► running ◄──── setPaused(false)
   ▲                  │   └─────► paused (setPaused(true))
   └────── reset ─────┘
```

| Command group                                                   | idle     | running / paused         |
| --------------------------------------------------------------- | -------- | ------------------------ |
| `setFirstFrame`, `setReferences`, `setSeed`, `setResolution`    | accepted | `locked_while_running`   |
| `setPrompt`                                                     | accepted | live scene from the next chunk; `not_ready` before the first chunk |
| `setMove`, `setLook`, `setAction`, `setPaused`                  | accepted | accepted, next chunk     |
| `start`                                                         | → running | `already_running`       |
| `reset`                                                         | clears inputs | ends, clears        |

Natural completion keeps the inputs; `reset` clears them all (no first frame,
no views, no prompt, seed -1, `480p`, no movement or action, not paused).

## The snapshot

`state_update` carries the whole observable state: `state`, `settings` (each
input as last sent), `applied` (what the session runs with), `width`, `height`,
`fps`, `chunks`, `frames`, `capabilities` and `error`. It arrives on connect (to
the joiner only), after every accepted command, when `paused` changes, and on
the chunk that applies a movement or action change. `app/lib/world.tsx` keeps
the latest one in React state and in a ref, and clears it on disconnect.
`settings` and `applied` are open objects in the schema; `world.tsx` types the
documented fields.

`applied.scene_max_tokens` is null until the first chunk, which is also when a
live `setPrompt` stops returning `not_ready`. The template enables the scene
switch from that field. `chunk_complete` reports the action each chunk ran with
(`action`, `action_text`) and its scene; the overlay shows it.

## Commands and refusals

No command declares a reply: every wrapper resolves `undefined`, accepted or
refused. A refusal surfaces on `lastError` with `operation: "sendCommand"` and
the model's `code`. There is no `command_error` broadcast.

The setup sequence in `WorldSetup.tsx` therefore confirms each step through the
`state_update` it emits: `settings.first_frame_set`, `settings.references`,
`settings.prompt`, then `state` leaving `idle`. If the update does not arrive,
it reports `lastError`. `refusals.ts` maps every code in `model_behaviour.md` to
a sentence; keep the code visible next to it for support.

`state_update.error` is set only when a session accepted by `start` could not be
built (`start_failed`): the state returns to `idle` with every input kept.

## Uploads

Upload with `uploadFile`, then pass the `FileRef` to the command. The first
frame is cropped to cover 832×480 (`480p`). References replace the whole list;
`setReferences({ items: [] })` clears it. Send views in the order the scene was
made with: head, left, right, front, back. The template checks PNG/JPEG, 20 MiB
and the 2:1 limit before uploading; the server enforces `unsupported_media`,
`undecodable_image`, `too_many_references` and `reference_too_elongated`.
Upload references belong to the session that created them; never reuse one
across connections.

## Held input

Movement, look and actions are held keys. `setMove({ forward, right })` and
`setLook({ yaw, pitch })` take -1, 0 or 1 per axis; fractions are refused.
`setAction({ name, text })` holds one of `sprint`, `shield`, `jump`,
`energy_projectile`, `crouch`, `repeated_casting`, or `custom` with your own
`text`; send `{ name: "none", text: "" }` when it ends. A preset with text, or
`custom` without, is `unsupported_value`. A custom action is encoded the first
time it is used, so that chunk takes longer.

The sample offers `jump` and `crouch` (held with 1 and 2) and a custom action,
matching the Reactor Sandbox. A click on an action holds it for
`ACTION_SECONDS` (3 s) and another click restarts the clock; a held number key
wins over a clicked action. Add a preset to `PRESET_ACTIONS` in
`app/lib/controls.ts` to offer it.

`WorldDeck.tsx` keeps every input source in a ref and computes what to send in
the same call that changes it, so a press and release in one tick both reach the
model. It sends only the axes that changed, queues the sends in order, and
releases everything on blur, tab hide, focus moving into a text field, and
teardown. Keep that release logic if you add input sources (gamepad, mouse
look).

## Video and sound

`AbotWorldHaloMainVideoView` renders `main_video` (24 fps). `main_audio` is
48 kHz mono; `WorldView.tsx` plays it through its own `<audio>` element with a
mute control and a browser-blocked fallback. Each chunk's audio arrives with
its picture; with server-side denoising on, a chunk's last frame arrives with
the next chunk.

## Auth

The API key stays on the server. The token route returns `{ jwt, expires_at }`
with `Cache-Control: private, no-store`, scopes `authorization_details` to
`reactor/abot-world-halo`, and bounds token sessions at ten. `token.ts`
memoizes the JWT in module scope, coalesces concurrent requests and fetches
with `cache: "no-store"`. Every hop for a session must reuse its token. A world
can run past the one-hour token: reconnect, or bind a replacement token to the
existing session, before it expires.

## Adding controls and example worlds

`app/lib/scenes.ts` holds the example worlds: a name, a one-line description, a
first frame, five character views and a scene, all from AMAP's ABot World Studio
gallery on Reactor's CDN. A live scene switch reads best when it stays
continuous with its world ("the same moor, at night"). Put new controls in the
state that owns them, gate them on the snapshot, and show their refusal.

| Not exposed in the UI | Command                    | Note                                       |
| --------------------- | -------------------------- | ------------------------------------------ |
| Fixed seed            | `setSeed({ seed })`        | -1 random or 0–2147483647; idle only        |
| 768p                  | `setResolution({ name })`  | Only on 2- and 4-GPU deployments; check `capabilities` |

### Reactor design system

The visual reference is the XMAX X2.1 developer template, as in Genie 4: the
compact header with the masked Reactor wordmark, the local `components/ui`
Button and Panel, mono uppercase eyebrows, the gold focus ring, a 320 px
sidebar and an 832:480 stage that fits the viewport with the controls deck
under it, media first on small screens. Extend those primitives rather than adding raw colors.

## Checks when extending

- Install, build and typecheck in this folder and in a fresh copy.
- Start from an example and from your own uploads, with 0 and 5 views; try a
  wide reference (refused) and Start without a prompt.
- Hold and release movement and look; tap a key quickly; hold 1 and 2; click an
  action and the custom Trigger; release outside the button, switch tabs, focus
  a text field.
- Switch the scene live after the first chunk; pause, resume, reset, restart.
- Disconnect and reconnect without stale state.
- Confirm video and audible sound separately.
- Unset `REACTOR_API_KEY`: the setup landing renders without a token request.
