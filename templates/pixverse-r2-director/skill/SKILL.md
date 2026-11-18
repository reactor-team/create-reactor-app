---
name: building-pixverse-r2-director-frontends
description: Extend this PixVerse R2 Director app (Reactor) with presets, controls, and commands while preserving its session, token, playback-buffer, and state-snapshot behavior.
---

# Extend this PixVerse R2 Director app

Director (`reactor/pixverse-r2-director`) builds a world from a description and reference images, then queues 5 to 10 s clips that continue one another and play on the output tracks. The frontend's job reduces to mirroring one `session_state` snapshot and sending typed commands in the model's phases.

The UI presents this as a short film. A world is shown as the *film*, a clip as a *shot*, and the shot list the person writes before pressing Generate is the app's own: it becomes one `enqueue` per shot. Code and this file use the model's names (`world`, `clip`, `scene`) so they match the typed SDK.

## The typed SDK

`@reactor-models/pixverse-r2-director` (class, types, provider, and hooks) is generated from the model's published schema. Every description in its type declarations is the model's own documentation; read them before adding a command. The version is pinned exactly in `package.json`, and `pnpm-workspace.yaml` exempts that version from pnpm's minimum release age. Update both together.

For a command the typed SDK does not have yet, `sendCommand("command_name", data)` is available on the same object until the SDK is regenerated.

## The four concepts

| Concept | API |
| --- | --- |
| Connection | `usePixverseR2Director()`: `status`, `connect`, `disconnect`, `lastError` |
| Commands | `createWorld`, `attachWorld`, `enqueue`, `play`, `stop`, `pop`, `setAutoplay`, `endRun`, `getState` |
| Messages | `usePixverseR2DirectorSessionState`, `…ClipQueued`, `…ClipGenerated`, `…ClipStarted`, `…ClipFinished`, `…ClipStopped`, `…ClipFailed`, `…ClipPopped` |
| Tracks | `<PixverseR2DirectorMainVideoView />`: video only |

## How the app is put together

```text
ToastProvider                        app/components/Toasts.tsx
  PixverseR2DirectorProvider         @reactor-models/pixverse-r2-director
    SavedClipsProvider               app/components/SavedClips.tsx
      DirectorSessionProvider        app/lib/session.tsx   ← the flow
        Shell                        app/components/Shell.tsx
          stage + sidebar            DirectorStage, SceneReel, WorldSetup, SceneComposer
```

- **`app/lib/session.tsx` owns the flow.** It mirrors `session_state`, holds the setup the person is editing, and exposes actions (`start`, `enqueue`, …). It is the only file that calls the model.
- **Components only read and call.** `useDirector()` gives them state and actions. A component never imports from `@reactor-models/pixverse-r2-director` except `PixverseR2DirectorMainVideoView`.
- **`app/lib/presets.ts` holds the defaults.** Images live in `public/presets/`.
- **`StatusBadge` and `CommandError`** read the generic store (`useReactor`), so they work unchanged for any Reactor model.

## UI phases

```text
idle ──create_world──▶ creating_world ──▶ world_ready ──enqueue──▶ starting ──▶ generating
  └──attach_world──────────────────────────┘                                      │
                                     end_run / idle_seconds / max_seconds ──▶ ending ──▶ ended | failed
                                                                     (the next enqueue starts a new run)
```

| Sidebar shows | When (`settingUp` in `session.tsx`) |
| --- | --- |
| `WorldSetup` | no world on the snapshot, or the person pressed New film |
| `SceneComposer` | a world is current (or being created) |

The app gates on `status === "ready"` as well as the phase: `session.tsx` exposes the snapshot as `null` whenever the session is not ready, so a stale phase cannot leave controls visible after a disconnect.

The provider runs without `autoConnect`. The primary button connects as its first step; the status panel's Connect lets a person watch the lifecycle first. Set `connectOptions={{ autoConnect: true }}` on the provider in `DirectorApp.tsx` for a product that should connect on load.

## Where a change goes

| You want to… | Change |
| --- | --- |
| Add or edit a default world | `app/lib/presets.ts`, plus images in `public/presets/` |
| Add a field the person sets before starting | the `WorldSetup` type and `setupFromPreset` in `session.tsx`, the setup panel, and the command call in `start` |
| Use a command the UI does not use yet | a new action in `session.tsx` that calls the typed method; a control in a component that calls the action |
| React to a message | a `usePixverseR2Director<Message>()` hook inside `session.tsx` |
| Show something new on the video | `DirectorStage.tsx`; keep overlays small and in the corners |
| Change what the stage says | `app/lib/status.ts` |

```tsx
// app/lib/session.tsx — add the action
const endScene = useCallback(async () => {
  await modelRef.current.endRun();         // typed; replies session_state
}, []);
// …add it to DirectorValue, the value object, and the useMemo deps.

// app/components/SomePanel.tsx — use it
const { endScene } = useDirector();
<Button onClick={() => void endScene()}>End the run</Button>
```

## What's intentionally not exposed

| Knob | Typed method or field | Phase | Note |
| --- | --- | --- | --- |
| Draw on a subset of reference images | `enqueue({ reference_indexes })` | run open | Cannot be combined with a frame reference |
| Move from one reference image to another | `enqueue({ first_frame_ref, last_frame_ref })` | run open | Not every generation worker builds `last_frame_ref`; the clip fails with `unsupported_reference` |
| Enhance the world description | `createWorld({ enhance_prompt })` | setup | |
| Reuse a world across visits | `attachWorld({ world_id })` from storage | setup | The app only reuses worlds made in this visit |
| End the run by hand | `endRun()` | run open | Used by New world; built clips stay ready |

## Auth: a no-store route and a memoized resolver

`app/api/reactor/token/route.ts` exchanges the server-only `REACTOR_API_KEY` for `{ jwt, expires_at }`, under `Cache-Control: private, no-store`, scoped by `authorization_details` to `MODEL_NAME` from `app/lib/models.ts`, with a bounded `max_sessions`. The scoped name must equal the `MODEL_NAME` the provider connects with: a mismatch mints fine and fails on `connect()`.

`resolveToken` in `app/lib/token.ts` keeps the token in module scope until shortly before expiry, coalesces concurrent mints, and fetches with `cache: "no-store"`. A session only accepts the token that created it, so the resolver must return the same token for the session's whole life; never lean on the browser's HTTP cache or mint per request. Pass the module-level `resolveToken` itself to the provider: a new resolver identity makes the provider rebuild its connection.

## The state snapshot

```tsx
usePixverseR2DirectorSessionState((next) => setSnapshot(next));
useEffect(() => {
  if (status !== "ready") setSnapshot(null);
}, [status]);
```

`session_state` arrives on connect and on every change. Mirror it once, derive everything from it, and clear it when the session is not ready: no final snapshot arrives on disconnect. Do not reconstruct state from `clip_*` messages; use those for reactions (a toast on `clip_failed`).

Two things the snapshot does not say: `clips` can still list an earlier world's scenes after `endRun`, so `session.tsx` remembers their ids and hides them; and nothing is sent on the video track before the first `play`, so the stage shows the Reactor mark and the session's status until then.

## Sending commands

Every typed command resolves with its reply and never rejects. `undefined` means refused or failed; the reason is on the SDK's `error` event (`lastError`, `operation: "sendCommand"`, the model's `code`). `CommandError` shows the latest one in the sidebar, with `app/lib/errors.ts` supplying shorter copy for common codes; add friendlier lines there. Do not listen for a `command_error` message: this model raises.

`createWorld` replies nothing; the world's readiness arrives on the snapshot (`world_ready`), and clips queued during `creating_world` wait for it, so the app does not block on it. `enqueue` replies `clip_queued`; the app treats `undefined` as "keep the draft".

Every wait ends. A step that waits on the network gets a time limit (`withTimeout` in `app/lib/timeout.ts`) and a Cancel while it runs; on a timeout or Cancel `session.tsx` disconnects so the next attempt starts clean. Each press of the primary button is one attempt (`attemptRef`), so a result from an abandoned attempt is ignored.

## Playback buffer

Scenes build one at a time, each from the last frame of the one before. Measured on prod, a scene costs about 2.6 seconds plus 1.1 seconds per second of video: a 10 second scene is ready every 13.4 seconds, a 5 second one every 8. No length keeps up with real time, and short scenes fall behind fastest, so the opening scenes are 10 seconds (`SCENE_SECONDS`).

Playing each scene the moment it is built stalls between scenes. `start` turns autoplay off, and `session.tsx` turns it on once 30 seconds of scenes are ready (`BUFFER_SECONDS`), or once nothing more is building. From 30 seconds, 10 second scenes play for about two minutes before the buffer runs dry. The stage says `Buffering · N of 30 s ready` until then. There is no autoplay switch: shots play by themselves, as a stream should. Raise the buffer for longer stretches without a stall, at the cost of a longer wait before the first frame.

## Media

The stage renders the output through `PixverseR2DirectorMainVideoView`, video only. The model has no audio track, so there is no mute control. The view is mounted whenever the session is ready and hidden until there is something to show, so autoplay permission is in place by the time the first frame arrives.

## Idle billing

A connected session bills whether or not anything is generating. The app disconnects after five quiet minutes with nothing building or playing. Keep that timer when you add activity, and reset `lastActivity` from any new action.

## Curated content

`WORLD_PRESETS` is the whole library: the setup panel reads it, and each preset's `openingScenes` fill the shot list. The app opens on `BLANK_SETUP` in `session.tsx`; set the initial state to `setupFromPreset(WORLD_PRESETS[0])` to open on a preset instead. Prompts describe the action and how the view moves; the word "camera" can put a camera in the picture.

## Brand alignment

Design tokens come from `@reactor-team/ui/styles.css` through the `@theme` aliases in `app/globals.css` (`bg-brand`, `text-brand-fg`, `bg-active`, `font-mono`). The local primitives in `app/components/ui/` (`Panel`, `Button`, `SegmentedToggle`, `INPUT`, `EYEBROW`, `FOCUS_RING`) are the only chrome; do not import the UI library's React components, which force server components into `"use client"`.

## Capturing clips

`SavedClips.tsx` is the one place the app uses the base `@reactor-team/js-sdk` directly: `requestClip(seconds)` and `requestRecording()` from `useReactor`, and `<ClipPlayer>` / `<ClipDownloadButton>` for playback and download. A `RecordingError` (`RECORDER_DISABLED`, `DISCONNECTED`, `INVALID_DURATION`, `REQUEST_TIMEOUT`) becomes a toast. Capture only works when recording is enabled for the model's deployment; a `RECORDER_DISABLED` reply is a deployment setting, not a bug in this code. Clip URLs are short-lived: saved clips live in memory for the page visit and are not shareable artifacts.

## Common mistakes when extending

- Sending a command from a component instead of an action in `session.tsx`, so two files disagree about the flow.
- Keeping a second copy of model state, or building it from `clip_*` messages.
- Gating on the phase alone; the snapshot must also be from a ready session.
- Offering `first_frame_ref` on the first clip of a run (`invalid_reference`), or combining it with `reference_indexes`.
- Minting a token per request, or creating the resolver inside a component.
- Adding a wait with no time limit, or a long wait with no Cancel.
- Letting the page scroll on a desktop: panels scroll inside the sidebar; the stage keeps its place.

## Checklist for new components

- Reads state through `useDirector()`; calls actions, not the model.
- Shows only in its phase, and only while `status === "ready"` where the model is involved.
- Any refusal it can cause is visible (CommandError covers typed commands).
- Works on a phone: the stage is pinned on top and the sidebar scrolls beneath it.
- `pnpm typecheck` and `pnpm build` pass; the flow runs start to finish against the live model, including disconnect and reconnect.
