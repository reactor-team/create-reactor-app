---
name: building-pixverse-r2-persona-frontends
description: Extend this PixVerse R2 Persona app (Reactor) with characters, controls, and commands while preserving its session, token, microphone, and state-snapshot behavior.
---

# Extend this PixVerse R2 Persona app

Persona (`reactor/pixverse-r2-persona`) creates a character from one portrait and runs a live call: it speaks on video and audio, hears the microphone, and reads `say`. The frontend's job reduces to mirroring one `session_state` snapshot and sending typed commands in the model's phases.

## The typed SDK

`@reactor-models/pixverse-r2-persona` (class, types, provider, and hooks) is generated from the model's published schema. Every description in its type declarations is the model's own documentation; read them before adding a command. The version is pinned exactly in `package.json`, and `pnpm-workspace.yaml` exempts that version from pnpm's minimum release age. Update both together.

For a command the typed SDK does not have yet, `sendCommand("command_name", data)` is available on the same object until the SDK is regenerated.

## The four concepts

| Concept | API |
| --- | --- |
| Connection | `usePixverseR2Persona()`: `status`, `connect`, `disconnect`, `lastError` |
| Commands | `listVoices`, `createCharacter`, `attachCharacter`, `startCall`, `say`, `endCall`, `getState` |
| Messages | `usePixverseR2PersonaSessionState`, `…Transcript`, `…QuestionReceived`, `…CharacterAction`, `…InputDeclined`, `…CallEnded` |
| Tracks | `publish("mic", track)` in; `<PixverseR2PersonaMainVideoView audioTrack="main_audio" />` out |

## How the app is put together

```text
ToastProvider                        app/components/Toasts.tsx
  PixverseR2PersonaProvider          @reactor-models/pixverse-r2-persona
    SavedClipsProvider               app/components/SavedClips.tsx
      PersonaSessionProvider         app/lib/session.tsx   ← the flow
        Shell                        app/components/Shell.tsx
          stage + sidebar            PersonaStage, CharacterSetup, Conversation
```

- **`app/lib/session.tsx` owns the flow.** It mirrors `session_state`, holds the setup the person is editing, and exposes actions (`call`, `say`, `hangUp`, …). It is the only file that calls the model.
- **Components only read and call.** `usePersona()` gives them state and actions. A component never imports from `@reactor-models/pixverse-r2-persona` except `PixverseR2PersonaMainVideoView`.
- **`app/lib/presets.ts` holds the defaults.** Portraits live in `public/presets/`.
- **`StatusBadge` and `CommandError`** read the generic store (`useReactor`), so they work unchanged for any Reactor model.

## UI phases

```text
idle ──create_character──▶ creating_character ──▶ character_ready ──start_call──▶ starting ──▶ connecting ──▶ live
  └──attach_character──────────────────────────────┘                                                            │
                                          end_call / idle_seconds / call_max_seconds / a failure ──▶ ending ──▶ ended | failed
```

| Sidebar shows | When |
| --- | --- |
| `CharacterSetup` | `inCall(phase)` is false |
| `Conversation` | `starting`, `connecting`, `live`, `ending` |

The app gates on `status === "ready"` as well as the phase: `session.tsx` exposes the snapshot as `null` whenever the session is not ready, so a stale phase cannot leave call controls visible after a disconnect.

The provider runs without `autoConnect`. The Call button connects as its first step; the status panel's Connect lets a person watch the lifecycle first. Set `connectOptions={{ autoConnect: true }}` on the provider in `PersonaApp.tsx` for a product that should connect on load.

## Where a change goes

| You want to… | Change |
| --- | --- |
| Add or edit a default character | `app/lib/presets.ts`, plus a portrait in `public/presets/` |
| Add a field the person sets before calling | the `CharacterSetup` type and `setupFromPreset` in `session.tsx`, the setup panel, and the command call in `call` |
| Use a command the UI does not use yet | a new action in `session.tsx` that calls the typed method; a control in a component that calls the action |
| React to a message | a `usePixverseR2Persona<Message>()` hook inside `session.tsx` |
| Show something new on the video | `PersonaStage.tsx`; keep overlays small and in the corners |
| Change what the stage says | `callStatus` in `PersonaStage.tsx` |

## What's intentionally not exposed

| Knob | Typed method or field | Phase | Note |
| --- | --- | --- | --- |
| What the character says to declined input | `createCharacter({ refusal_reply })` | setup | Blank: a polite change of subject |
| Reuse a character across visits | `attachCharacter({ character_id })` from storage | setup | A `character_not_found` failure clears the id |
| The typed `mic` helpers | `publishMic(track)` / `unpublishMic()` | call | The app uses the generic `publish("mic", …)`; either works |
| Video seen by the character | none | | The model has no inbound video track |

## Auth: a no-store route and a memoized resolver

`app/api/reactor/token/route.ts` exchanges the server-only `REACTOR_API_KEY` for `{ jwt, expires_at }`, under `Cache-Control: private, no-store`, scoped by `authorization_details` to `MODEL_NAME` from `app/lib/models.ts`, with a bounded `max_sessions`. The scoped name must equal the `MODEL_NAME` the provider connects with: a mismatch mints fine and fails on `connect()`.

`resolveToken` in `app/lib/token.ts` keeps the token in module scope until shortly before expiry, coalesces concurrent mints, and fetches with `cache: "no-store"`. A session only accepts the token that created it, so the resolver must return the same token for the session's whole life; never lean on the browser's HTTP cache or mint per request. Pass the module-level `resolveToken` itself to the provider: a new resolver identity makes the provider rebuild its connection.

## The state snapshot

```tsx
usePixverseR2PersonaSessionState((next) => setSnapshot(next));
useEffect(() => {
  if (status !== "ready") setSnapshot(null);
}, [status]);
```

`session_state` arrives on connect and on every change. Mirror it once, derive everything from it, and clear it when the session is not ready: no final snapshot arrives on disconnect. Do not reconstruct state from `transcript` messages; use those for reactions (a line in the conversation). Nothing is sent on the video track before `live`, so until then the stage shows the Reactor wordmark, or the call's status while one starts or ends.

## Sending commands

Every typed command resolves with its reply and never rejects. `undefined` means refused or failed; the reason is on the SDK's `error` event (`lastError`, `operation: "sendCommand"`, the model's `code`). `CommandError` shows the latest one in the sidebar, with `app/lib/errors.ts` supplying shorter copy for common codes; add friendlier lines there. Do not listen for a `command_error` message: this model raises.

Commands that drive a following step are awaited for their reply:

```ts
const ready = await model.createCharacter({ image, name, persona, voice, aspect_ratio });
if (!ready) return;                        // refused: CommandError already shows why
charactersRef.current.set(key, ready.character_id);
await model.startCall();
```

Every wait ends. A step that waits on the network gets a time limit (`withTimeout` in `app/lib/timeout.ts`) and a Cancel while it runs; on a timeout or Cancel `session.tsx` disconnects so the next attempt starts clean. Each press of Call is one attempt (`attemptRef`), so a result from an abandoned attempt is ignored.

## Media

The app publishes the microphone before `start_call`, so the first words are heard, and releases it when the call ends or the session drops. Only real samples reach the character: a muted track (`track.enabled = false`) is not heard. Speech before `speech_ready` is not answered; the conversation's input is disabled until then.

The character does not speak first. Once a call is `live` with `speech_ready` and `video_receiving` both true, `session.tsx` sends `say("Hello!")` once, so the character opens with a greeting. The greeting is not added to the conversation; the character's reply is. `list_voices` also lists `saturn_zh_*` voices, which have a strong accent in English; `CHINESE_VOICE` in `presets.ts` leaves them out.

The play button beside the voice picker plays a recorded greeting from `public/voices/<voice>.mp3`, one per voice in `SAMPLED_VOICES`, each made from the model with the same line. It needs no session. A voice without a file shows the button disabled; to add one, record the model saying the same greeting in that voice, save it as a mono MP3 under `public/voices/`, and add the voice to `SAMPLED_VOICES`.

The stage renders the output through `PixverseR2PersonaMainVideoView` with `audioTrack="main_audio"`. The view is mounted whenever the session is ready and hidden until there is something to show, so autoplay permission is in place by the time the first frame arrives.

## Idle billing

A connected session bills whether or not anything is generating. The app disconnects after three minutes outside a call (`IDLE_DISCONNECT_MS`), and the timer restarts whenever the phase or a busy step changes. Keep that timer when you add an action that runs outside a call.

## Curated content

`CHARACTER_PRESETS` is the whole library: the setup panel reads it, and a preset fills every field. The app opens on `BLANK_SETUP` in `session.tsx`, with no portrait; `call` asks for one before anything else. Set the initial state to `setupFromPreset(CHARACTER_PRESETS[0])` to open on a preset instead. `persona` is what the character knows and does; a stage direction written there can be read aloud.

## Brand alignment

Design tokens come from `@reactor-team/ui/styles.css` through the `@theme` aliases in `app/globals.css` (`bg-brand`, `text-brand-fg`, `bg-active`, `font-mono`). The local primitives in `app/components/ui/` (`Panel`, `Button`, `SegmentedToggle`, `INPUT`, `EYEBROW`, `FOCUS_RING`) are the only chrome; do not import the UI library's React components, which force server components into `"use client"`.

## Capturing clips

`SavedClips.tsx` is the one place the app uses the base `@reactor-team/js-sdk` directly: `requestClip(seconds)` and `requestRecording()` from `useReactor`, and `<ClipPlayer>` / `<ClipDownloadButton>` for playback and download. A `RecordingError` (`RECORDER_DISABLED`, `DISCONNECTED`, `INVALID_DURATION`, `REQUEST_TIMEOUT`) becomes a toast. Capture only works when recording is enabled for the model's deployment; a `RECORDER_DISABLED` reply is a deployment setting, not a bug in this code. Clip URLs are short-lived: saved clips live in memory for the page visit and are not shareable artifacts.

## Common mistakes when extending

- Sending a command from a component instead of an action in `session.tsx`, so two files disagree about the flow.
- Keeping a second copy of model state, or building it from `transcript` messages.
- Gating on the phase alone; the snapshot must also be from a ready session.
- Minting a token per request, or creating the resolver inside a component.
- Adding a wait with no time limit, or a long wait with no Cancel.
- Replacing the person's description or persona when they pick an image.
- Letting the page scroll on a desktop: panels scroll inside the sidebar; the stage keeps its place.

## Checklist for new components

- Reads state through `usePersona()`; calls actions, not the model.
- Shows only in its phase, and only while `status === "ready"` where the model is involved.
- Any refusal it can cause is visible (CommandError covers typed commands).
- Works on a phone: the stage is pinned on top and the sidebar scrolls beneath it.
- `pnpm typecheck` and `pnpm build` pass; the flow runs start to finish against the live model, including disconnect and reconnect.
