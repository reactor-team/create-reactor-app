---
name: extend-genie-4
description: Extend this Genie 4 world explorer using its typed commands, authoritative session snapshots, held keys, video and sound.
---

# Extending Genie 4 World explorer

Genie 4 makes interactive worlds from a prompt, an opening image, or both.
One world runs for up to 60 seconds; ending it leaves the connection available
for another. You have cloned this folder: decide which phase owns a new control
before changing the component tree.

It uses the typed package `@reactor-models/genie-4@0.1.4` on base SDK `3.3.0`.

## Four concepts

| Concept    | API                                                                         |
| ---------- | --------------------------------------------------------------------------- |
| Connection | `Genie4Provider`, `useGenie4()` status/connect/disconnect                   |
| Commands   | `startWorld`, `setKeys`, `instruct`, `endWorld`, `getState`                 |
| Messages   | `useGenie4SessionState(handler)`; flattened fields such as `state.phase`    |
| Tracks     | `Genie4MainVideoView`; `useGenie4Track("main_audio")` with an audio element |

Model-specific imports come from `@reactor-models/genie-4`. Only generic
recording code in `SnapClip.tsx` imports the base SDK directly. No camera or
microphone input is needed. The provider declares both output tracks. Gallery assets in `public/images/`
are generated opening frames, and are uploaded as model input, not merely
decorative thumbnails.

## UI phases

```text
idle → starting → live → ending → ended
          └────────┴──────────────→ failed
ended / failed → starting (new inputs, new world)
```

| State                 | Visible controls                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Disconnected          | Click a gallery image or custom Start to connect and launch; manual Connect is available |
| Idle / ended / failed | `WorldStarter`: prompt, image, start/retry                                               |
| Starting              | `WorldControls`: movement and end                                                        |
| Live                  | Movement, instructions, end and authoritative countdown                                  |
| Ending                | Status until the starter returns                                                         |

Each component owns its own snapshot and early return; do not introduce a
phase context. Gate on both `status === "ready"` and the model phase.
`Genie4Provider` deliberately leaves auto-connect off. A gallery click or custom Start is an explicit user action that connects on
demand. `WorldStarter` registers a Ready waiter before calling connect, blocks
concurrent launches, bounds the wait at 60 seconds, fetches initial state,
then uploads and starts. A disconnect cancels a pending launch via the local `genie4:cancel-launch`
event; launch versions discard late completions and controls stay disabled
until cancellation reaches Disconnected; every async
upload is fenced to its original ready session. A production product may
pass `autoConnect` after choosing its desired connection experience.

## State snapshots and messages

Subscribe before connecting. Each snapshot consumer uses
`useState<Genie4SessionStateMessage | null>` and `useGenie4SessionState`, clears
state whenever connection/session changes, then reads `await getState()`.
The effect cancels its pending reply on cleanup so an old session cannot
overwrite a new session's state. Keep generated wrapper functions in refs
when used by effects; they are recreated on render.

`session_state` is the only message. It contains phase, keys combined across
clients, `video_receiving`, `audio_receiving`, elapsed/max seconds, end reason
and `last_error`. Use `max_seconds - elapsed_seconds` for the countdown.
Use `useGenie4Message` only for a genuinely broader message consumer.

## Commands and their answers

| Typed method                                | Allowed phase                | Awaited result / confirmation                         |
| ------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| `startWorld({ prompt?, reference_image? })` | idle, ended, failed          | No result; broadcast confirms starting/live or failed |
| `setKeys({ keys })`                         | Any; effective starting/live | No result; broadcast reports combined keys            |
| `instruct({ text })`                        | live                         | No result; world applies the instruction              |
| `endWorld()`                                | Any; idempotent              | Correlated `session_state` reply                      |
| `getState()`                                | Any                          | Correlated `session_state` reply                      |

Await every command. Reply-bearing commands resolve `undefined` on refusal;
the other commands return `undefined` on success as well. The SDK reports
command failures through `lastError` with `operation: "sendCommand"`; promises
do not reject. `Connection` visibly labels command refusals separately from
connection errors and permits dismissing them. Never infer success from an
undefined result, listen for `command_error`, or use a broadcast as a
correlated answer. Do not optimistically claim that an instruction was applied.

Stable command refusal codes are `busy`, `invalid_input`, `invalid_image`,
and `not_live`. Later world failures are different: show the snapshot's
`last_error.reason`, code, retryability and trace reference. The next start
clears the previous world failure. Do not hide it behind a loading overlay.

## Inputs and acknowledgments

`WorldStarter` keeps the file local until Start. Validate MIME type, 20 MiB
and 40 MP limits; `await uploadFile(file)` returns the typed upload reference.
Pass it directly as `reference_image` in `startWorld`. For image-only start,
pass `prompt: ""`: this release rejects a null prompt, which the serializer
can produce from an explicitly undefined property. There is no separate
image-conditioning command or acceptance message to wait for. Check the
session still matches after upload before sending Start.

Prompts and instructions are at most 2,000 characters. Start needs a nonblank
prompt or image. Inputs are read at world start; live changes use `instruct`.
An ended world cannot resume: start again with the selected inputs.

## Held keys

Send the entire local held set on every change. Valid keys are `w a s d e`,
literal space `" "`, and lowercase arrow key names. Keep keyboard and pointer
holds separately, union them, and serialize changes so a rapid release cannot
overtake a press. Discard queued sends belonging to an old connection or world
control generation. Never send only the last key pressed.

Release on keyup, blur, hidden document, editable-field focus, pointer up,
pointer cancel, lost pointer capture, end and component cleanup. Pointer
capture keeps release delivery outside a button. Ignore keydown in editable
fields, capture dialogs and media controls, and release on focus entering them. World state reports combined keys from all clients, not just yours.

## Video and sound

`WorldView` renders the generated video view muted and binds the separate
`main_audio` track to a hidden audio element. It requests unmuted autoplay when
the track arrives. A compact speaker button sits inside the video, rather than
a separate sound card or native media bar. If browser policy blocks autoplay,
the same button becomes **Enable sound** and retries `play()` in a user gesture.
The button also toggles mute. Track cleanup pauses and detaches the audio
element; never stop a track owned by the SDK. World keyboard controls ignore
focus inside the sound control's `data-world-ui` container.

The three compact gallery thumbnails sit in one row, without a gallery heading.
The gallery, custom prompt and image upload share one continuous sidebar. Custom
inputs remain visible without a disclosure. Sidebar sections use the shared Panel
section variant; the sidebar owns the outer card border. The video frame keeps
its 16:9 ratio and fits both available dimensions without cropping or stretching.
The empty stage intentionally contains no placeholder copy. A 60-second timer
sits at the top right of the scene panel; while live, the controls derive the
remaining time from the authoritative snapshot. Neither media availability nor
an unmuted element alone proves audible content; verify playback independently.

## Auth

The API key stays on the server. The token route returns `{ jwt, expires_at }`
with `Cache-Control: private, no-store`, scopes `authorization_details` to
the account-qualified `reactor/genie-4`, and bounds token sessions at ten.
`token.ts` memoizes the JWT in module scope, coalesces concurrent requests,
and fetches with `cache: "no-store"`. Every hop for a session must reuse its
token; browser caching and localStorage cannot provide that identity rule.

The one-hour token is refreshed shortly before expiry. For long visits,
bind a replacement token to the existing session or reconnect before expiry;
blindly replacing a live session's token loses authorization for its later
uploads and recordings. Keep missing-key rendering in the server page.

## Adding controls and curated content

Add the component in the owning phase, subscribe to full state if needed,
clear it on disconnect, status-gate the command, and handle its refusal visibly.
The shared `app/lib/prompts.ts` library contains scene IDs, titles, image URLs,
starting prompts and live instructions. These are editorial examples. Preserve a place's continuity
when adding scene changes, and never replace user-authored text during upload.

### Reactor design system

The current visual reference is the XMAX X2.1 developer template. This sample
uses its compact header, official Reactor wordmark, and local `components/ui`
Button, Panel, label and focus primitives. Extend those primitives rather than
creating new per-control styling.

| Element           | Required treatment                                                                     |
| ----------------- | -------------------------------------------------------------------------------------- |
| Typography        | Aeonik sans and IBM Plex Mono from `@reactor-team/ui/styles.css`                       |
| App surfaces      | `zinc-950` canvas, `zinc-900/40` panels, `zinc-800` borders                            |
| Primary actions   | `bg-brand text-brand-fg` mapped to light-gold/interstellar tokens                      |
| Secondary actions | Zinc borders, compact spacing, shared Button variants                                  |
| Panels and labels | One rounded-lg sidebar with p-3 sections; mono 10px uppercase eyebrows                               |
| Focus             | Shared gold ring and zinc-950 offset, including inputs and links                       |
| Header            | Compact model title, model descriptor and official masked Reactor wordmark             |
| Layout            | Desktop 320px continuous scrollable sidebar; 16:9 stage fits width/height, media first on small screens |
| Status            | Flora only for semantic ready/live state; neutral colors for ordinary chrome           |

Keep model behavior specific to Genie 4 while inheriting this product chrome.
Do not invent a model-specific palette or replace shared primitives with raw
colors. Import brand CSS, not the UI package's React components in server
components. Check both desktop and narrow layouts against this reference before
handing off a design change.

| Intentionally unexposed extension | API / phase                 | Note                                                              |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Joining a shared session          | Provider connection options | Model keys combine across clients                                 |
| Manual state refresh              | `getState()`, ready         | Initial refresh already runs automatically                        |
| Full-session recording            | `requestRecording()`, ready | Use the generic recording surface in a separate capture component |
| Pause, resume, seeds, camera pose | Not supported               | Do not invent commands                                            |

All five model commands are already used in the starter.

## Capturing clips

`SnapClip` gates requests on ready status, calls generic `requestClip(10)`,
catches `RecordingError`, and composes `ClipPlayer` with `ClipDownloadButton`.
Both receive the shared memoized `getJwt` resolver. The modal stays mounted
after disconnect so a captured clip can still download. `hls.js` is a direct
dependency for preview in browsers without native HLS. Player and download
errors remain visible. Short-lived clip URLs are not shareable artifacts.

Recording must be enabled on the deployment; `RECORDER_DISABLED` requires a
capability fix, not a success claim. Verify request, preview, saved MP4 playback
and sound. A custom UI may use `useClipDownload`; full-session capture may use
`requestRecording`. Recording availability is deployment-specific; repeat capture checks when
the deployment or SDK changes.

## Checks when extending

- Install, build and typecheck in this standalone folder and a fresh copy.
- Verify text-only, image-only and combined inputs; invalid input and refusal.
- Drive keys, release outside buttons, switch focus/tabs, and disconnect.
- End, restart, wait for timeout, recover from failure, and reconnect without stale state.
- Confirm generated video, audible sound, and saved playable clips independently.
- Verify a gallery click from disconnected connects, uploads its image and
  starts once; cancel during connection/upload and confirm no delayed start.
- Verify default audio, mute/unmute and the browser-blocked playback fallback.
- Unset `REACTOR_API_KEY`: the setup landing must render without a token request.
- Scaffold with `npx create-reactor-app my-app --model=genie-4` and confirm a fresh install builds.
