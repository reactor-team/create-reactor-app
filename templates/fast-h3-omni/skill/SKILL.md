---
name: fast-h3-omni
description: Extend the FastH3-Omni starter for prompt-only, image-guided, audio-guided, and continuing clips. Covers the queue and player lifecycle, media limits, session-scoped authentication, and safe state handling.
---

# Extending FastH3-Omni

You have cloned this folder and want to add a control or another way to compose
a clip. Keep the model's queue and player as the source of truth. This app pins
`@reactor-models/fast-h3-omni@0.2.0`; use its generated types, provider,
hooks, and command methods for model-specific work.

## The model in three sentences

An `enqueue` request starts a clip from a prompt, optionally guided by ordered
reference images and audio, or continued from a retained generated clip.
Generation happens in the background, and a built clip moves from the
generation queue to the playout queue. Playback is separate: enable autoplay
or play a ready clip, then render synchronized `main_video` and `main_audio`.

## The four concepts

| Concept | What the app needs |
| --- | --- |
| Connection | Connect only when a user queues work; disconnect ends this browser's session. |
| Commands | Call `useFastH3Omni().enqueue`, `setAutoplay`, `play`, `stop`, and `reset` through `run()`. The reply, and a refusal, belong to the awaited call. |
| Messages | `useFastH3OmniMessage` provides a discriminated message union. `state_update` and `queue_update` are full snapshots; `clip_generated` and `clip_failed` are reactions to builds. |
| Tracks | `FastH3OmniMainVideoView` renders the 24 fps video; `useFastH3OmniTrack("main_audio")` provides synchronized 48 kHz audio. Verify audio separately. |

## UI phases

| Phase | Visible |
| --- | --- |
| Disconnected | Composer and setup guidance. |
| Connecting or uploading | Composer remains visible but cannot submit twice; progress appears beside the video. |
| Ready and building | Current queue counts from `state_update`, plus the video stage. |
| Playing | Video, audio, and transport controls. |

Every component that holds a snapshot clears it when the SDK status leaves
`ready`. The SDK sends no final state snapshot on disconnect; an old `playing`
flag otherwise survives into a new session. Do not reconstruct queues from
`clip_started` or `clip_generated`; use the full `queue_update` snapshot.

## Composing a clip

Text alone works. The composer offers three scene starters, guided fields for
action, camera, sound, and music, and a full-prompt tab. `app/lib/prompt.ts`
assembles guided fields with numbered image and audio definitions; the full
tab sends exactly what the user writes. Images are ordered references, not
starting frames: the first upload
is `Picture 1` in the prompt, the second `Picture 2`, and so on. Audio
references are ordered as `Audio 1`, `Audio 2`, and `Audio 3`. State whether
each is a voice, ambient sound, or the complete soundtrack, and name the
pictured speaker when lip sync matters. Audio needs at least one image or a
retained clip to continue.

The picture cards show their upload order and let a user name a person,
object, or scene. Those names are UI aliases, not an `enqueue` field: the
guided prompt replaces a mention like “Aki” with `<Subject 1>` and defines it
against `<Picture 1>`. A voice reference bound to Aki becomes a line tying
`<Audio 1>` to `<Subject 1>`. Audio cards name each clip's role. A complete soundtrack suppresses
the guided sound and music fields because the soundtrack is reused as recorded.
In full-prompt mode, users must describe their picture and audio references
themselves. The preview does not infer those roles from file names.

The browser checks obvious limits in `scene.ts` and `media.ts`; the model is
the authority on decoded media and the prompt's token count. The limits are:

- Up to nine JPEG, PNG, or WebP images, each at most 25 MiB and 25 million
  pixels, aspect 1:4 through 4:1.
- Up to three WAV, MP3, AAC/M4A, Ogg/Opus, FLAC, or WebM audio clips, each
  2–15 seconds and at most 25 MiB. A continuation leaves room for at most two.
- One of 5.875, 8, 10.125, 12.25, or 14.375 seconds. Other values are
  refused, not rounded. Read `clip_seconds_choices` from the state snapshot
  if you add a dynamic duration picker.

Upload after connecting with `useFastH3Omni().uploadFile`, in the order shown
to the user, and pass the returned `FileRef` objects directly to `enqueue`.
Each queued clip pins its own references; a
later upload does not change it. A refused command fails its own call (see
[Refusals](#refusals)). A generation that started but failed emits
`clip_failed` and is removed; do not silently retry a paid request.

## Refusals

The model refuses a command by failing that command's request with a stable
`code` and a reason written for the person using the app. The caller learns
on its own call, and only the caller is told: another client in the session
never sees a refusal of a command it did not send. Branch on `code`; show the
reason.

The SDK never rejects a command call. A refused call resolves `undefined`,
and the failure arrives on the SDK's `error` event with
`operation: "sendCommand"` and a message of the form
`command 'enqueue' failed (queue_full): <reason>`. `run()` in
`app/lib/command.tsx` reads it off the call:

```ts
const { run } = useCommand();
const queued = await run("enqueue", () => model.enqueue({ prompt, seconds }));
if (!queued.ok) throw new Error(queued.refusal.reason); // code: queued.refusal.code
```

Three rules it encodes:

- `undefined` from a command with a declared reply (`enqueue`, `set_*`,
  `reset`, `pop`, `move`) and no failure attached is still a refusal, shown
  as "The model refused this command." A model release that reports refusals
  another way resolves like that.
- `play` and `stop` have no reply, so `undefined` is also success. Pass
  `{ expectsReply: false }`; only a failure counts.
- A refusal is not a connection problem. The SDK's `lastError` holds every
  failure, refusals included, so `Studio` reads `useSessionError()` for
  connection failures and reports refusals from the call.

`app/lib/command.tsx` is model-agnostic, which is why it imports
`@reactor-team/js-sdk` directly. Do not learn about refusals from a
`command_error` message: the refusal belongs to the call, and that message
reaches every client in the session.

| Command | Reply | Codes it can fail with |
| --- | --- | --- |
| `enqueue` | `clip_queued` | `empty_prompt`, `metadata_too_long`, `queue_full`, `invalid_request`, `invalid_image`, `invalid_audio`, `request_rejected` |
| `play` | none | `already_playing`, `no_ready_clip` |
| `stop` | none | `not_playing` |
| `pop` | `clip_popped` | `unknown_clip` |
| `move` | `clip_moved` | `invalid_position`, `unknown_clip` |
| `set_clip_seconds` | `clip_length_accepted` | `invalid_seconds` |
| `set_seed` | `seed_accepted` | `invalid_seed` |
| `set_canvas` | `canvas_accepted` | `session_not_empty`, `invalid_aspect` |

`set_autoplay`, `set_flush_on_clip_end`, `reset`, `get_state`, and
`get_queue` do not refuse.

## Continuing a generated clip

`continue_from_clip_id` requires a generated clip retained by this session.
Use a `clip_generated` notification or a fresh model snapshot to select it;
the id returned by `enqueue` is not proof that it has finished building.
The model keeps the eight most recent generated clips. An unknown, old,
reset, or wrong-canvas id is refused. The next clip's prompt still needs to
describe its subjects, setting, action, camera, and sound; the continuation
carries motion and audio through the boundary, not the whole previous prompt.
The stage's “What should happen next?” field appends a new beat to the last
submitted scene description and reuses its references. A continuation accepts
at most two audio references; `validateDraft` reports an error if the previous
scene used three.

## Authentication

`app/api/reactor/token/route.ts` keeps `REACTOR_API_KEY` on the server and
mints a session-scoped JWT for `MODEL_NAME` imported from
`@reactor-models/fast-h3-omni/core`, with bounded `max_sessions`. This matches
the typed provider's model identifier. The
route returns `{ jwt, expires_at }` under
`Cache-Control: private, no-store`. The client must reuse that same JWT in
module memory until shortly before expiry and fetch the route with
`cache: "no-store"`. A fresh token is not automatically authorized for a
session created under the old one; do not refetch a token for every SDK hop.

## Useful controls to add next

| Control | Model command | Place |
| --- | --- | --- |
| Canvas | `set_canvas` | Before queues contain clips; 16:9, 1:1, 9:16, or 4:3. |
| Seed | `set_seed` or `enqueue.seed` | Beside the duration picker. |
| Default length | `set_clip_seconds` | Setup; per-clip `enqueue.seconds` already covers this example. |
| Queue management | `pop` and `move` | A queue panel driven by `queue_update`. |
| Hold the last frame | `set_flush_on_clip_end` | Near the autoplay toggle. |
| First/last keyframes | `enqueue.first_frame_image` and `last_frame_image` | An advanced image-guided flow; follow the package's `continue_mode` rules. |

Recording is not advertised by this starter until the deployment's recording
support is confirmed. A later capture UI can use the base SDK's generic clip
helpers while keeping model-specific commands on the typed package.

## Checklist

- Keep the auth route scoped, no-store, and matched to the typed provider's
  account-qualified model name.
- Send commands through `run()` and await them; show refusals and
  `clip_failed` distinctly, and keep both out of the connection status.
- Clear state and queue snapshots on disconnect.
- Verify image, audio, text-only, and continuation paths in a browser after a
  typed SDK or schema upgrade.
- Run `pnpm build` and a fresh install from an isolated copy of this folder.
