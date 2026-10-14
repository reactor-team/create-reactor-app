---
name: h3-reference-turbo-realtime
description: Extend the H3 Reference Turbo Realtime starter — a queue-and-player app where every clip is conditioned on one to nine reference images. Covers the reference contract, the queue contract, continuation between clips, the typed SDK, and the auth shape.
---

# Extending H3 Reference Turbo Realtime

You have cloned a working app: pick a mode, bring references, say what happens,
and keep the scene going shot by shot. This is what you need to know before
changing it.

## How the app is put together

Three modes live in `app/lib/shot.ts`: `one-subject`, `two-subjects`, and
`free`. A mode is a **slot layout** plus a prompt strategy. The two guided
modes collect a description per reference and assemble the six-section prompt
in `buildPrompt`; free mode sends the text exactly as typed. Adding a mode
means adding a slot layout and, if it needs one, a branch in `buildPrompt` —
not a new component tree.

`app/lib/session.tsx` owns the state the two halves share. The composer writes
the draft; the stage and the continuation box read it. It also holds the
uploaded `FileRef` per slot, which is what lets a follow-on shot reuse the same
references without uploading the same bytes twice — uploads are session scoped,
so they stay valid for the whole session.

### Every clip is one somebody asked for

The session generates nothing on its own. It opens with the shot in the
composer, and goes on only when the next beat is typed into the continuation
box. Playback runs dry between clips, and that is deliberate: a clip takes as
long as it takes to build, and filling the gap with invented beats spends the
account's credits on video nobody asked for and pushes the scene somewhere
nobody chose.

If you do want a channel that never stops, drive it from a script rather than
from this UI, and give whatever picks the next beat a real source — a playlist,
a chat room, a schedule. The `h3-livestream` template is that shape.

The `inFlight` ref guards re-entry: `queueShot` and `steer` both upload before
they enqueue, so without it a double click sends the same shot twice.

Three more behaviours are deliberate and worth keeping:

- **Autoplay is turned on at connect**, before the first enqueue. A queued clip
  that needs a button press to appear reads as a broken app.
- **Uploads are sequential**, not `Promise.all`. Slot order is what binds
  `Picture N`.
- **The prompt is rebuilt, not patched, on continuation.** `continueShot`
  swaps only the action and re-renders the whole prompt, so the subject
  definitions and the look are restated. Each clip is prompted on its own, so
  omitting them is what makes a seam obvious.

## Which H3 template am I in?

Three templates run on H3-family models. They are not interchangeable.

| Template                    | Model                                            | Shape                                                                     |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `h3-reference-turbo-realtime` (this one) | `reactor/h3-reference-to-video-turbo-realtime`   | One browser drives its own session. Every clip needs reference images.    |
| `h3-livestream`             | `reactor/h3-reference-to-video-turbo-realtime`   | A Python streamer holds the session; many viewers watch over LiveKit.     |
| `fast-h3`                   | `reactor/fast-h3`                                | A **different model**. Text, `starting_frame`, or `ending_frame`. No references. |

`fast-h3` is still served and is not a fallback for this model. The commands
look nearly identical, which is exactly why porting code between them without
reading the schema goes wrong.

## The model in three sentences

Each `enqueue` pairs a prompt with one to nine reference images and returns a
clip id. The clip builds in the background, and `clip_generated` announces
when it has moved to the ready queue. Playback is a separate step: `play` a
ready clip, or turn on autoplay and let ready clips start whenever the output
is idle.

## The four concepts

| Concept    | API                                                                          |
| ---------- | ---------------------------------------------------------------------------- |
| Connection | `useH3().status / connect / disconnect`                                      |
| Commands   | `enqueue`, `play`, `stop`, `pop`, `move`, `reset`, `set*`, `get*`, through `run()` |
| Messages   | `state_update`, `queue_update`, `clip_*` lifecycle                           |
| Tracks     | `main_video` with synchronized `main_audio`                                  |

## The reference contract

This is the model's whole point, and the part with a real trap in it.

- **Every clip needs one to nine references.** There is no text-only path. An
  empty list, or more than nine, is refused.
- **Order is meaning.** The first image is `Picture 1` in the prompt, the
  second `Picture 2`. `ReferenceSlot` puts that badge on the thumbnail itself,
  so the binding is visible rather than explained in a paragraph nobody reads.
- **A reference is not a keyframe.** It guides subjects and appearance. It does
  not fix the first or last frame, and it is not cropped to the canvas.
- **A reference can be a place.** One image per character plus one for the
  setting is a strong set. So is a single portrait.
- **Each clip owns its references.** They are pinned at enqueue time; later
  uploads do not touch a clip that is already queued, building, or playing.

### One reference or a list

Both take a `FileRef` straight from `uploadFile`. Pass them through as they
come:

```ts
await enqueue({ prompt, reference_image: ref }); // one
await enqueue({ prompt, reference_images: refs }); // one to nine
```

Send exactly one of the two. The model refuses a request carrying both.

This needs no conversion, but it is worth knowing why, because older code
carries one. Until `@reactor-team/js-sdk` 3.0.2 the SDK only lifted uploads out
of a command's top-level values, so a `FileRef[]` was left in the JSON payload
and serialized with its camelCase fields — not the `{ upload_id }` the model
reads. Every caller hand-wrote that conversion. 3.0.2 serializes the array and
`reactor-runtime` 3.3.1 resolves it, so the `FileRef[]` the typed SDK has
always advertised is now true on the wire. If you find a `toReferenceImages`
helper in code copied from elsewhere, delete it.

**Upload order matters, so upload sequentially.** `prepare` in
`app/lib/session.tsx` loops rather than using `Promise.all`, because slot order
is what binds `Picture N`.

**Uploading needs a live session.** That is why `queueClip` connects first.
There is no Connect button anywhere in this app: a session starts when there
is work for it.

## The queue contract (what the UI mirrors)

- `enqueue` replies `clip_queued` with the clip's id, its **effective**
  duration and frame count, and its seed. Your requested `seconds` is rounded
  to a supported length, so read the reply rather than assuming.
- Two queues, both in `queue_update`: `generation` (waiting and building) and
  `playout` (ready). The playing clip is in neither.
- `queue_update.history` is **always empty**. A played clip is not listed and
  cannot be replayed. To carry a scene forward, use `continue_from_clip_id`.
- `state_update` carries the capacities. A full generation queue refuses new
  enqueues; a full ready queue pauses building until something plays.
- `valid_commands` reflects the current state, but arguments still need
  validating, and state can change before your request lands.
- **Mirror the model; do not accumulate.** The transport row in `Stage` reads
  its counts off `state_update` directly. Building your own queue out of
  `clip_*` events is where drift comes from.

## Continuation between clips

`continue_from_clip_id` continues the next clip from a **generated** clip's
ending: motion, camera, and audio carry across the boundary, while the new
clip's own references still drive appearance. An unknown or dropped id falls
back to an independent clip rather than failing.

Writing the continued clip matters as much as setting the field:

- Repeat the subject definitions. Each clip is prompted on its own.
- Restate the lighting, weather, and palette, and open the action with "the
  shot continues from…".
- **Update a subject whose state changed.** If a clip ends with a mask pushed
  up, the next clip must describe it that way, even though the reference image
  still shows it down.

`set_flush_on_clip_end` is a different thing. It chooses black or a held last
frame at a playback boundary. It does not request continuation.

## The typed SDK

Every model-specific symbol comes from
`@reactor-models/h3-reference-to-video-turbo-realtime`, generated from the
model's published schema and installed like any other dependency. Write no
wire strings by hand: a hand-built command name or field drifts from the
deployed model, which is the defect the typed packages exist to prevent.

The package version tracks the model release, so `0.3.0` here describes the
`0.3.0` release on the API. Upgrading it is how you pick up a schema change.

`app/lib/model.ts` maps its symbols to short names
(`useH3ReferenceToVideoTurboRealtimeStateUpdate` → `useH3StateUpdate`) and adds
the few constants the schema does not carry, such as the canvas dimensions.
Keep the aliases in that one file rather than renaming anything at a call site.

## Auth: the no-store route + the memoized resolver

Four rules, all load-bearing:

1. The `rk_` key stays server-side. `app/api/reactor/token/route.ts` reads it
   and mints a short-lived JWT; the browser only ever holds the JWT.
2. The token is scoped to this model through `authorization_details`. That
   scope must equal the name the provider connects with, or `connect()` 403s.
3. The route answers `Cache-Control: private, no-store`.
4. The client memoizes the token in **module scope** until shortly before
   expiry. This is not an optimization: a session may only be operated by the
   exact token that created it, and the SDK re-calls the resolver on every
   later hop. A browser cache can drop an entry without warning, and a
   refetched token has no sessions bound, so every later hop 403s.

## The state snapshot pattern

Every component that holds state does the same thing:

```tsx
const [state, setState] = useState<H3State | null>(null);
useH3StateUpdate(setState);
if (status !== "ready" && state) setState(null); // mandatory
```

The clear is not optional. The SDK sends no final snapshot on disconnect, so a
stale one leaves the UI claiming capacity and playback the session no longer
has.

## Sending commands

- **Await the reply.** A command's answer resolves the call. Do not subscribe
  to a hook to catch it — that hook fires for *any* call of that command, and
  never on a second client.
- **Read a refusal off the call.** See [Refusals](#refusals) below; every
  command in this app goes through `run()`.
- **A resolved await means the handler finished.** `play` and `stop` answer
  with no body, and that is still a barrier — delete any sleep meant to "give
  the model time".
- `clip_failed` is different from a refusal: the command was accepted, the
  build started and then failed. That clip is dropped and nothing retries on
  its own.

## Refusals

The model refuses a command by failing that command's own request with a
stable `code` and a reason written for the person using the app. That is the
thing to build on, for three reasons:

- **The caller learns on its own call**, so nothing has to guess which
  command a refusal belongs to.
- **Only the caller is told.** A second tab or a viewer in the same session
  never sees a refusal of a command it did not send.
- **The code is stable.** Branch on `code`; show the reason.

The SDK never rejects a command call. A refused call resolves `undefined`,
and the failure arrives on the SDK's `error` event with
`operation: "sendCommand"` and a message of the form
`command 'enqueue' failed (queue_full): <reason>`. `try/catch` will not see
it. `run()` in `app/lib/command.tsx` reads it off the call:

```ts
const { run } = useCommand();
const outcome = await run("enqueue", () => enqueue({ prompt, reference_images: refs }));
if (!outcome.ok) {
  outcome.refusal.code; // "queue_full"
  outcome.refusal.reason; // shown by <CommandError />
  return;
}
outcome.reply?.clip.clip_id;
```

`run()` records the refusal for `<CommandError />`, and the next command that
succeeds clears it. It also encodes three rules:

- `undefined` from a command with a declared reply (`enqueue`, `pop`, `move`,
  `set*`, `reset`) and no failure attached is still a refusal, shown as "The
  model refused this command." A model release that reports refusals another
  way resolves like that.
- `play` and `stop` have no reply, so `undefined` is also success. Pass
  `{ expectsReply: false }`; only a failure counts.
- A refusal is not a connection problem. The SDK's `lastError` holds every
  failure, refusals included, so `StatusBadge` reads `useSessionError()`,
  which skips them.

Do not learn about refusals from a `command_error` listener. The typed package
still exports the hook, but the refusal belongs to the call, and that message
reaches every client in the session.

| Command            | Reply                  | Codes it can fail with                                                                                         |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `enqueue`          | `clip_queued`          | `empty_prompt`, `metadata_too_long`, `queue_full`, `invalid_request`, `invalid_image`, `invalid_audio`, `session_changed` |
| `play`             | none                   | `already_playing`, `no_ready_clip`                                                                             |
| `stop`             | none                   | `not_playing`                                                                                                  |
| `pop`              | `clip_popped`          | `unknown_clip`                                                                                                 |
| `move`             | `clip_moved`           | `invalid_position`, `unknown_clip`                                                                             |
| `set_clip_seconds` | `clip_length_accepted` | `invalid_seconds`                                                                                              |
| `set_seed`         | `seed_accepted`        | `invalid_seed`                                                                                                 |
| `set_canvas`       | `canvas_accepted`      | `session_not_empty`, `invalid_aspect`                                                                          |

`set_autoplay`, `set_flush_on_clip_end`, `reset`, `get_state`, and `get_queue`
do not refuse. A failure that never reached the model (no session yet) comes
back through `run()` too, with an SDK code such as `INVALID_STATE`.

## What is intentionally not exposed

| Knob                    | Command                 | Where it would go              |
| ----------------------- | ----------------------- | ------------------------------ |
| Default clip length     | `set_clip_seconds`      | Composer; per-clip `seconds` covers most cases |
| Default seed            | `set_seed`              | Composer, beside the seed field |
| Hold last frame         | `set_flush_on_clip_end` | Near the autoplay toggle       |
| Reorder or drop a queued clip | `move`, `pop`     | No queue list is rendered; autoplay means clips rarely wait |
| Clip metadata           | `enqueue.metadata`      | Echoed back on every clip message; useful for correlating your own records |

## Capturing clips

`SnapClip` records the live session and is model-agnostic — it imports
`@reactor-team/js-sdk` directly, which is idiomatic only here and in
`app/lib/command.tsx`, because recording and command failures are base-SDK
features the typed clients do not re-export. Drop the
file into another template unchanged.

## Common mistakes when extending

1. Converting a `FileRef[]` to `{ upload_id }` by hand before sending it. The
   SDK does that; a manual conversion now sends the wrong shape.
2. Sending both `reference_image` and `reference_images`.
3. Uploading with `Promise.all`, which scrambles `Picture N`.
4. Uploading before connecting.
5. Assuming the requested `seconds` is what you got, instead of reading the
   reply.
6. Treating the prompt as character-bounded. It is bounded by the model's text
   budget, and going past it is not a refusal — `enqueue` accepts the clip and
   the build fails with `clip_failed`. The composer's token readout is an
   estimate for exactly this reason.
7. Forgetting the snapshot clear on disconnect in a new component.
8. Hardcoding capacities or duration bounds instead of reading `state_update`.
9. Treating `set_flush_on_clip_end` as continuation.
10. Subscribing to a hook for a command's own answer instead of awaiting it.
11. Building queue state from `clip_*` events instead of `queue_update`.
12. Reading refusals from a `command_error` listener, or showing one through
    `lastError` — a full queue then looks like a lost connection.

## Checklist for a change

- `pnpm build` passes (it runs `tsc --noEmit`), and so does `pnpm test`, which
  pins how `app/lib/refusal.ts` reads a refused command.
- Any new state-holding component clears its snapshot when
  `status !== "ready"`.
- New commands go through `run()` and are awaited; refusals surface in
  `CommandError`, never in the connection status.
- Anything touching references still sends one to nine, in order, through the
  right path for one versus many.
- Run the app: connect, queue a multi-reference clip, play it, then disconnect
  mid-run and reconnect to confirm no stale snapshot survives.
