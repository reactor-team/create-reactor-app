---
name: pika-h3-flex
description: Extend the Pika H3 Flex starter, a live video stream that keeps its session open so more clips queue up, for prompt-only, reference-guided, first/last-frame, and continuing clips with sound. Covers the two adapters, the queue and player lifecycle, Pika's media and prompt limits, refusals read off the call, the canvas, resolution and clip-length controls, session-scoped authentication, and safe state handling.
---

# Extending Pika H3 Flex

You have cloned this folder and want to add a control or another way to compose
a clip. Keep the model's queue and player as the source of truth. This app pins
`@reactor-models/pika-h3-flex@3.0.2`; use its generated types, provider,
hooks, and command methods for model-specific work.

## The model in three sentences

An `enqueue` request starts a clip with its own soundtrack from a prompt,
optionally guided by ordered reference images and audio, or continued from a
retained generated clip. Generation happens in the background, and a built
clip moves from the generation queue to the playout queue. Playback is
separate: enable autoplay or play a ready clip, then render synchronized
`main_video` and `main_audio`.

v3 runs both of Pika's adapters in one service and picks one per clip from
its inputs; no field chooses, and `clip.adapter` reports which built it:

| Clip | Adapter | Sends |
| --- | --- | --- |
| Prompt only | FL2VA | `prompt` |
| First and/or last frame | FL2VA | `first_frame_image`, `last_frame_image` |
| Frame continuation | FL2VA | `continue_from_clip_id`, `continue_mode: "frame"`, prompt only |
| References | Ref2VA | `reference_images`, `reference_audios` |
| Latent continuation | Ref2VA | `continue_from_clip_id`, `continue_mode: "latent"`, references allowed |

Frame images never share a clip with references or a continuation, a frame
continuation takes no references, and audio needs a picture or a latent
continuation beside it. The model refuses each of these with
`invalid_request`; `validateDraft` in `scene.ts` checks them first.

Reference videos (`reference_videos`, experimental) are not in the composer.

## The live stream

The app is one realtime session used as an endless stream. Each Generate is
an `enqueue` with autoplay on, so a clip plays as soon as it is built. The
session stays open after each clip, so more prompts queue up behind it; the
queue panel, play/skip and “Continue this scene” all act on that session.
The app does not save clips as files. What to queue next is yours: by hand
with "Continue this scene", or with the optional live director below.

### Where the prompt rules come from

The rules come from Pika's own prompt guidance (`docs/prompt-guidance.md` in
Pika-Labs/Pika-H3-Flex) and Reactor's prompt guide. `[Shot N]` cut times,
`(S1)` speaker IDs, `<d>[English] …</d>` dialogue tags and the six-field
structure are Pika's documented rules, for a prompt someone writes by hand.
The automatic prompt doesn't use them: it writes only definition lines (or a
frame clip's alignment line) and the user's text, because a half-filled
six-field prompt makes claims the user didn't make. For example,
`overall_soundscape: N/A` asks for silence.

## The four concepts

| Concept | What the app needs |
| --- | --- |
| Connection | Start opens a session early; generating opens one if needed. Disconnect ends this browser's session. |
| Commands | Call `usePikaH3Flex().enqueue`, `setCanvas`, `setAutoplay`, `play`, `stop`, `pop`, `move`, and `reset`. The reply to a command belongs to the awaited call. |
| Messages | `usePikaH3FlexMessage` provides a discriminated message union. `state_update` and `queue_update` are full snapshots; `clip_generated` and `clip_failed` are reactions. |
| Tracks | `PikaH3FlexMainVideoView` renders the video; `usePikaH3FlexTrack("main_audio")` provides synchronized audio, played through a separate `<audio>` element. Verify audio separately. |

## UI phases

| Phase | Visible |
| --- | --- |
| Disconnected | Composer, Start, and setup guidance. |
| Connecting or uploading | Composer remains visible but cannot submit twice; progress appears on the video. |
| Ready and building | Queue counts from `state_update`, the queue panel, and the stage. |
| Playing | Video, audio, and transport controls. |

`Studio.tsx` holds the snapshots and clears them when the SDK status leaves
`ready`. The SDK sends no final snapshot on disconnect; an old `playing` flag
otherwise survives into a new session. Do not reconstruct queues from
`clip_started` or `clip_generated`; use the full `queue_update` snapshot.

### Asking for state without a loop

The model broadcasts `state_update` and `queue_update` after each change, but
not on connect, so `Studio.tsx` calls `getState()` and `getQueue()` once when
the status becomes `ready`.

`usePikaH3Flex()` returns new command functions on every render, and every
message re-renders. Never list them as effect dependencies: an effect keyed on
`getState` re-runs on each reply, asks again, and loops without end (hundreds
of thousands of messages in minutes, and a hung page). Key the effect on
`status` and read the latest functions through a ref, as `Studio.tsx` does.

## Refusals arrive on the call

A refused command fails the sender's own call. With `@reactor-team/js-sdk` 3.x
the await never rejects: it resolves `undefined`, and the SDK first raises its
error with `operation: "sendCommand"`, the model's `command_code`, and the
reason. `usePikaH3Flex().lastError` mirrors it, which `Studio.tsx` shows as
`code: reason`. Check each awaited reply: `undefined` means refused.

The model also broadcasts each refusal as a `command_error` message to every
client in the session. The app does not render it: it fires for refusals other
clients caused, and would repeat this client's own. `clip_failed` is different:
an accepted clip that failed to build, not tied to a call, so the app shows it.

| Command | Reply on the await | Refusal codes |
| --- | --- | --- |
| `enqueue` | `clip_queued` | `empty_prompt`, `queue_full`, `invalid_image`, `invalid_audio`, `request_rejected`, `invalid_request`, `metadata_too_long` |
| `setCanvas({ aspect })` | `canvas_accepted` | `session_not_empty`, `invalid_aspect` |
| `setResolution({ resolution })` | `resolution_accepted` | `session_not_empty`, `invalid_resolution` |
| `play({ clip_id? })` | none | `already_playing`, `no_ready_clip` |
| `stop()` | none | `not_playing` |
| `pop({ clip_id })` | `clip_popped` | `unknown_clip`, `has_dependents` |
| `move({ clip_id, position })` | `clip_moved` | `unknown_clip` |
| `setAutoplay`, `reset` | `autoplay_accepted`, `session_reset` | — |

## Composing a clip

Text alone works. The composer has four scene starters, one per shape:
text only (Treehouse), one picture with shots and a narrator (Product
reveal), several characters in conversation (Sitcom), and pictures with
voice references (Food truck), one description
box, and a live **Sent to Pika** panel showing the exact prompt:

- **Automatic** (default): `assembleBasicPrompt` in `app/lib/prompt.ts`
  builds the prompt from the description and the named references, in upload
  order. It writes the definition lines Pika's guidance recommends, such as
  `<Subject 1> is Aki, the character from <Picture 1>, retaining appearance
  and clothing.` and `<Audio 1> is the voice of <Subject 1>.` It then swaps
  each name in the description for its label. Every picture's content is a
  `<Subject N>`, as Pika's guidance asks (person, object, setting or style);
  the role picks the retention wording.
- **Manual:** typing in the panel takes the prompt over. It is then sent
  exactly as written, the description box locks, and "Back to automatic"
  returns. Refer to uploads as `<Picture N>` and `<Audio N>`.
- **First and last frame:** with a frame attached, `assembleFramePrompt` opens
  the prompt with Pika's alignment line for the frames sent
  (`frameAlignmentLine`), a blank line, then the description. The model never
  inserts it. The first frame is `<Picture 1>`; the last is `<Picture 2>`, or
  `<Picture 1>` alone. Frames and references lock each other out.

Generate, clip length, resolution, aspect and the token estimate sit in a
footer pinned to the bottom of the composer.

Images are ordered references, not first or last frames: the first upload is
`<Picture 1>`, and reordering changes the labels. Audio references are
`<Audio 1>` to `<Audio 3>`. Give each one a role, and tie a voice to the
person who uses it. Put the words you want spoken in the prompt, because a
voice reference only shapes how the voice sounds.

The browser checks Pika's limits in `scene.ts` and `media.ts`; the model is the
authority on decoded media and the prompt's token count:

- Up to nine images, each at most 25 MiB and 25 million pixels, aspect 1:4
  through 4:1.
- Up to three audio clips, each 2–15 seconds, **15 seconds together**, at most
  25 MiB. A latent continuation keeps all three: the continued clip's
  soundtrack takes the next label but no slot.
- **Audio needs a picture or a latent continuation beside it**, so the
  composer keeps the audio picker disabled until a picture is attached.
- A first and a last frame, JPEG, PNG or WebP, centre-cropped to the canvas.
- **2048 text tokens**, counted with the labels the model adds for each
  reference (and a continuation's timestamps). Over budget is refused with
  `request_rejected`, not cut. `estimatePromptTokens` is a rough browser
  estimate: the composer warns with it and never blocks.
- One length from `state_update.clip_seconds_choices` (25 values in v3); any
  other is refused, not rounded. Before a session exists the composer offers
  only `DEFAULT_CLIP_SECONDS` (10 s); once connected it shows the session's
  list and keeps the closest value (`nearestChoice`).

Upload after connecting with `usePikaH3Flex().uploadFile`, sequentially and in
the order shown (order binds the labels), and pass the returned `FileRef`
objects to `enqueue`. Each queued clip pins its own references.

## The canvas, the queue, and continuation

- **Canvas.** `setCanvas({ aspect })` takes 21:9 through 9:21 (eleven ratios)
  and `set_resolution` takes `480p` (832×480 at 16:9) or `768p` (1344×768,
  the default). Both are refused while anything is queued or playing:
  `valid_commands` lists them only while the session is empty. The pickers
  are disabled then and show the session's values; otherwise `generate()`
  sets them before enqueueing.
- **Queue.** `pop` removes a clip from whichever queue holds it; popping an
  unbuilt clip that others continue from is refused (`has_dependents`). `move`
  reorders within a clip's own queue, 0 = front. The playing clip is in neither
  queue; `stop` cuts it, and with autoplay on it acts as skip.
- **History.** `queue_update.history` lists built clips no longer queued that
  `continue_from_clip_id` can still name (the eight most recent). The app does
  not show it yet.
- **Continuation.** `continue_from_clip_id` names the clip to continue, and
  `continue_mode` says how (the app always sends it with the id; sending it
  alone is refused). The picker above "Continue this scene" sets it:
  - `latent` (default, Ref2VA): the source's last 2.33 s of picture and
    sound condition the new clip, which keeps its references. The source must
    be one of the eight most recently built clips. "Continue this scene"
    appends a beat to the scene description and reuses its references.
  - `frame` (FL2VA): the new clip opens on the source's last frame, prompt
    only, with no carried sound; the source can be any queued or retained
    clip, even unbuilt. `frameContinuationPrompt` opens with the first-frame
    alignment line and turns each `<Subject N>` back into the name its
    definition gave it, since no references are sent.

## The live director (optional)

With an LLM configured on the server (`LLM_PROVIDER`, `LLM_API_KEY`, optional
`LLM_MODEL` and `LLM_BASE_URL`; see `app/lib/llm.ts`), the Live panel writes
each next clip. The parts:

- `app/api/director/route.ts` takes `{ scene, recent, direction, seconds,
  mode, audios }` and returns `{ prompt }`. The key never leaves the server;
  the page only learns the provider and model name.
- `app/lib/director.ts` holds the writer's system prompt and message. The
  system prompt and the opening scene come first and never change within a
  stream; the last three clips and the direction come last, so a provider can
  cache the prefix. Frame continuations are wrapped with
  `frameContinuationFromWritten`, which adds the first-frame alignment line
  and strips any label the LLM slipped in.
- `app/useLiveDirector.ts` paces it. Keep these rules if you change it:
  - Write clip N+1 while clip N still builds; write once per queued tip.
  - Frame mode queues a written prompt at once, continuing from the last
    *queued* clip (it may be unbuilt; the model waits for it). Latent mode
    waits until that clip is built.
  - Write only while at most one clip waits ahead of playback
    (`generation` + `playout` ≤ 1), and count the clip just queued before
    `queue_update` lists it, or the writer races to a third.
  - A new direction drops the written-but-unqueued prompt and writes again.
    It never calls `reset`, `stop`, or `pop`.
  - Pause after 20 written clips and on any error, with the reason shown.
    Pause stops the writer and turns autoplay off.

Each clip is built only after the one it continues, so the stream keeps up
only when a clip builds faster than it plays. At the cut the next clip may
still be finishing; `flush_on_clip_end` off holds the last frame meanwhile.

## Authentication

`app/api/reactor/token/route.ts` keeps `REACTOR_API_KEY` on the server and
mints a session-scoped JWT for `MODEL_NAME` imported from
`@reactor-models/pika-h3-flex/core`, with bounded `max_sessions`. The route
returns `{ jwt, expires_at }` under `Cache-Control: private, no-store`. The
client reuses that same JWT in module memory until shortly before expiry and
fetches the route with `cache: "no-store"`. A session can only be operated by
the token that created it; do not refetch a token for every SDK hop.

## Useful controls to add next

| Control | Model command | Place |
| --- | --- | --- |
| Continue from any clip | `enqueue.continue_from_clip_id` | A picker over `playout` and `history`. |
| Play a specific clip | `play({ clip_id })` | A play button on ready rows. |
| Autoplay toggle | `set_autoplay` | The app turns it on for every generate. |
| Seed | `set_seed` or `enqueue.seed` | Beside the duration picker. |
| Hold the last frame | `set_flush_on_clip_end` | Near the autoplay toggle. |

Recording is not advertised by this starter until the deployment's recording
support is confirmed.

## Checklist

- Keep the auth route scoped, no-store, and matched to the typed provider's
  model name.
- Await command replies; treat `undefined` as refused and show the code from
  `lastError`. Do not render the broadcast `command_error`.
- Never list typed command functions as effect dependencies.
- Clear state and queue snapshots on disconnect.
- Never combine frame images with references or a continuation, and send a
  frame continuation no references; `validateDraft` checks before the model
  refuses with `invalid_request`.
- Read lengths and resolutions from `state_update`; never hardcode them.
- Verify image, audio, text-only, and continuation paths in a browser after a
  typed SDK or schema upgrade.
- Run `pnpm test`, `pnpm build`, and a fresh install from an isolated copy.
