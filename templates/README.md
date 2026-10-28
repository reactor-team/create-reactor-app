# API model templates

One runnable reference frontend per model Reactor serves on the API. Each
folder is a self-contained project: clone it, add an API key, and it runs. Each
also carries a `skill/SKILL.md` — an agent skill that captures the design
decisions, the gotchas, and the patterns for growing the template into a
product.

All but one are a single Next.js app. `fast-h3-livestream` runs as two parts, a
Python streamer beside a Next.js viewer, and sets up per part rather than from
the root.

These are the templates the CLI in this repo scaffolds from, so **a folder name
here is a public identifier**: `npx create-reactor-app my-app --model=<folder>`.
Renaming one breaks that command.

## The templates

| Template                                | Typed SDK                                                                                          | What it demonstrates                                                                                                                                                                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`happy-oyster/`](./happy-oyster)       | [`@reactor-models/happy-oyster`](https://www.npmjs.com/package/@reactor-models/happy-oyster)       | Interactive world model. Build a world from a prompt (or attach a permanent one), then travel it live: **Adventure** worlds you drive with WASD, **Directing** worlds you steer with text `instruct` plus pause/rewind. Mode-fixed sessions, authoritative `world_state` snapshot.                  |
| [`helios/`](./helios)                   | [`@reactor-models/helios`](https://www.npmjs.com/package/@reactor-models/helios)                   | Continuous prompt-driven video. Curated text and image scenes, mid-stream prompt hot-swap, atomic `setConditioning({ prompt, image })` for image-to-video, clip capture, design tokens from `@reactor-team/ui`.                                                                                     |
| [`lingbot/`](./lingbot)                 | [`@reactor-models/lingbot`](https://www.npmjs.com/package/@reactor-models/lingbot)                 | Interactive world model. Pick a starting image, drive the scene with WASD, layer curated dynamic events (rain, fog, …) as live prompt swaps, clip capture.                                                                                                                                          |
| [`lingbot-world-2/`](./lingbot-world-2) | [`@reactor-models/lingbot-world-2`](https://www.npmjs.com/package/@reactor-models/lingbot-world-2) | Interactive world model driven like a game. Two-axis WASD, per-latent `set_camera_pose` motion (mouse-look, roll, orbit, jump arcs, crouch dips), hold-key world events, a layered prompt workbench, attention-window and KV-cache knobs.                                                           |
| [`longlive-v2/`](./longlive-v2)         | [`@reactor-models/longlive-v2`](https://www.npmjs.com/package/@reactor-models/longlive-v2)         | Multi-shot **director's storyboard**. Compose shots and cuts on a chunk timeline, schedule beats ahead of time, then direct live. Surfaces the per-scene chunk budget and how cuts extend length.                                                                                                   |
| [`ltx2/`](./ltx2)                       | [`@reactor-models/ltx2`](https://www.npmjs.com/package/@reactor-models/ltx2)                       | Streaming **talking-head avatar**. Upload a face and a script; the model generates voice and lip-synced video together and streams both. The take in flight is frozen while the session stays editable — mid-run edits queue for the next take. Server-authoritative `valid_commands`, TTFF timing. |
| [`sana-streaming/`](./sana-streaming)   | [`@reactor-models/sana-streaming`](https://www.npmjs.com/package/@reactor-models/sana-streaming)   | Streaming **video-to-video editor**. Live webcam transform via a manual `camera` publish, file-clip editing with side-by-side compare, mid-stream re-prompting, seed control.                                                                                                                       |
| [`x2/`](./x2)                           | [`@reactor-models/x2`](https://www.npmjs.com/package/@reactor-models/x2)                           | Streaming **video-to-video editor** on XMAX X2. Webcam, file-clip or still-image sources on one `source` track, side-by-side compare, reference-image conditioning, drag-to-steer pointer on the output, keep-backlog toggle.                                                                       |
| [`xmax-x2-1/`](./xmax-x2-1) | [`@reactor-models/xmax-x2-1`](https://www.npmjs.com/package/@reactor-models/xmax-x2-1) | **Live video editing** with XMAX X2.1. Choose a webcam, clip or still image, prepare a reference and prompt, then start explicitly. Replace references live and guide motion with up to eight drag points across four-frame windows. |
| [`fast-h3/`](./fast-h3) | [`@reactor-models/fast-h3`](https://www.npmjs.com/package/@reactor-models/fast-h3) | Queued clip generation with an explicit player. Compose a multi-scene episode by hand or from a writer prompt, then watch chained clips play as one continuous video. Teaches the queue contract and the hard-cut prompting rule that keeps chained scenes from degrading. |
| [`fast-h3-omni/`](./fast-h3-omni) | [`@reactor-models/fast-h3-omni`](https://www.npmjs.com/package/@reactor-models/fast-h3-omni) | **Video with generated audio** from a scene prompt and optional ordered image and audio references. Try preset scenes, name pictured subjects in the guided composer, queue and play clips, then continue a finished clip with a new prompt. |
| [`h3-reference-turbo-realtime/`](./h3-reference-turbo-realtime) | [`@reactor-models/h3-reference-to-video-turbo-realtime`](https://www.npmjs.com/package/@reactor-models/h3-reference-to-video-turbo-realtime) | **Reference-to-video** on H3 Reference Turbo Realtime. Every clip is conditioned on one to nine ordered reference images, named `Picture 1`…`Picture N` in the prompt, so the composer is a reorderable reference set beside a six-section scene prompt. Queue, play, continue a scene into the next clip, and pick from four canvases. A different model from `fast-h3`, which takes keyframes rather than references. |
| [`vidu-s2-avatar/`](./vidu-s2-avatar) | [`@reactor-models/vidu-s2-avatar`](https://www.npmjs.com/package/@reactor-models/vidu-s2-avatar) | **Live conversational avatar** from one photo. Pick a character or upload a portrait, choose a persona and voice, then call with microphone and optional camera. Change its voice or reference images during the call, follow the transcript, and capture a clip. |
| [`vidu-s2-editing/`](./vidu-s2-editing) | [`@reactor-models/vidu-s2-editing`](https://www.npmjs.com/package/@reactor-models/vidu-s2-editing) | **Live video editing** from a camera or sample clip and one reference image. Swap characters, try on an outfit, restyle the scene, or change the background; switch references during the edit and compare the result with an inset source view. |
| [`visko-orbis-stable/`](./visko-orbis-stable) | [`@reactor-models/visko-orbis-stable`](https://www.npmjs.com/package/@reactor-models/visko-orbis-stable) | Continuous steerable video. The hero is the **mid-flight morph**: `setPrompt` during a run reshapes the picture at the next chunk boundary instead of cutting. Explicit `setImage` → `setPrompt` → `start` chain for image-to-video, plus resolution, seed, and audio knobs rendered from the state snapshot. |
| [`visko-orbis-dynamic/`](./visko-orbis-dynamic) | [`@reactor-models/visko-orbis-dynamic`](https://www.npmjs.com/package/@reactor-models/visko-orbis-dynamic) | The companion model to Visko Orbis Stable, same shape and same mid-flight morph. Its delivery-resolution list also offers `native`, which ships the model's own geometry instead of upscaling. |
| [`eden-live/`](./eden-live) | [`@reactor-models/eden-live`](https://www.npmjs.com/package/@reactor-models/eden-live) | **Play a game, watch it rendered as a new world.** Two modes: seven built-in games the model runs, picked from thumbnails and steered with a keyboard map and pointer-lock mouse look; or your own React Three Fiber game, played in the browser and streamed as client video. The generated world is large with the draft as picture-in-picture, an inline prompt reshapes it live, and a "+" tile copies a skill that lets a coding agent add a new game. |
| [`fast-h3-livestream/`](./fast-h3-livestream) | [`@reactor-models/fast-h3`](https://www.npmjs.com/package/@reactor-models/fast-h3) (in the streamer, via the Python SDK) | The same model as a **24/7 broadcast channel** rather than a private session. A Python streamer drives the model and publishes into a LiveKit room; a Next.js viewer watches the shared stream and its chat pitches the episodes. Two parts, so it sets up per part — see its README. |

## Running one

Each single-app folder is a standalone pnpm project and does **not** join a
workspace, so copying it out works exactly the way the scaffolding CLI does:

```bash
cd templates/helios
cp .env.example .env.local
# add REACTOR_API_KEY=rk_...

pnpm install
pnpm dev
```

API keys come from [reactor.inc/account/api-keys](https://www.reactor.inc/account/api-keys).

`fast-h3-livestream` is the exception: `streamer/` and `viewer/` install and run
separately, and the CLI skips the root install for it because there is no root
manifest to install. Its README carries both halves.

## How auth works in the browser templates

The same shape in every template whose browser drives the model, and the only
shape those templates document:

- The `rk_` **API key stays server-side**. It is read by
  `app/api/reactor/token/route.ts` and never sent to the browser.
- That route mints a **short-lived, session-scoped JWT** via Reactor's `/tokens`
  endpoint, pinned to the template's model through `authorization_details` with a
  bounded session budget. The JWT is the only credential the browser holds, and it
  can only operate sessions it created itself.
- The client hands a **resolver** to `<ModelProvider jwtToken={fetchToken}>`. The
  SDK calls it before every authenticated request, so no hop 401s on an aged-out
  token.
- The resolver **memoizes the token** in module scope until shortly before expiry
  and fetches `no-store`. This is not an optimization: a session-scoped token may
  only operate the sessions it created, so every hop of one session must present
  the same JWT, and a browser HTTP cache cannot promise that.

`fast-h3-livestream` is shaped differently because its browser does not drive
the model. The Reactor key lives with the **streamer**, which holds the session
server-side; the viewer only joins a LiveKit room, and its token route mints a
LiveKit token rather than a Reactor JWT. The rule that carries over is the one
that matters: the `rk_` key never reaches a browser.

Each `skill/SKILL.md` explains the failure mode if you break that last rule.

## What changed with `@reactor-team/js-sdk` 3.x

Every template whose browser drives the model targets 3.x (`fast-h3-livestream`'s
viewer speaks LiveKit and no Reactor SDK at all; its streamer uses the Python
`reactor-sdk`). One behavioural change matters more than the rest, and
no part of getting it wrong is a compile error:

**A command's result belongs on the awaited call, not on a subscription.** When a
model's handler answers with a message, that answer is **addressed**: the runtime
sends it to the one connection whose command earned it, correlated by request id.
On that connection it arrives twice over — it resolves the awaited call, and the
same frame also raises the `message` event — so a typed hook for an answer does
fire. It just fires for *any* call of that command on this connection, with no way
to say which, and it never fires on a second client in the session at all.

```tsx
// ⚠️ fires, but for any setImage on this connection — and never on a second
// client watching the same session.
useHeliosImageAccepted((msg) => setDimensions(msg));

// ✅ tied to this call, and it tells you the handler finished
const accepted = await setImage({ image: ref });
if (accepted) setDimensions(accepted);
```

The corollary for multi-client sessions: anything every client has to agree on
must **broadcast**, which is what a model's `state` snapshot is for. Never build
shared UI state out of answers.

Two more corollaries:

- **Awaiting a command that answers with nothing is still a barrier.** The runtime
  acknowledges every correlated command once its handler has run, so a resolved
  `await` means the handler finished. Delete any sleep that existed to "give the
  model time".
- **Commands never reject.** `try/catch` is not how you detect failure. Where the
  reason turns up is per-model, and the three shapes are genuinely different —
  see below.

Which commands answer, which broadcast, and which answer with nothing is
per-model, so each `skill/SKILL.md` carries the table for its own model. Check that
table before porting a pattern between folders — how one model reports a refusal is
not evidence for another.

**How a refusal reaches you, by model.** Two shapes, and they need different
client code:

| Models | A refused command… |
| --- | --- |
| `fast-h3`, `fast-h3-omni`, `h3-reference-turbo-realtime`, `helios`, `lingbot`, `lingbot-world-2`, `longlive-v2`, `ltx2`, `sana-streaming`, `vidu-s2-avatar`, `visko-orbis-stable`, `visko-orbis-dynamic` | resolves the call `undefined` and broadcasts `command_error` to every connection. Surface that hook. |
| `happy-oyster` | declares no `command_error`. It broadcasts its own `action_error` instead, typed as `ActionErrorMessage`. |
| `eden-live` | All eight commands return `StateUpdate`; a refusal resolves `undefined` and arrives on the SDK `error` event for that call with the model's code. Its schema declares only `state_update`, so do not assume a generated `command_error` hook. |
| `x2` | declares no `command_error` at all from its 1.0.0 release, so there is no hook. The refusal is the command's own error reply, which the SDK records on `lastError` and raises on the `error` event. |
| `xmax-x2-1` | declares no `command_error`. A refusal resolves the command `undefined` and reaches the SDK `lastError` / `error` event. Await successful command replies and follow broadcast state separately. |

A refusal is never the awaited value, so `undefined` — not a message with an
error-ish shape — is what a call site tests for.

## Conventions

- Standalone Next.js 15 + React 19 + Tailwind v4 + TypeScript.
- `@reactor-team/js-sdk` `^3.0.0`, plus one `@reactor-models/*` typed SDK per
  folder, generated from the model's published schema. A template that needs a
  model surface the SDK cannot yet carry pins a newer `js-sdk` than the floor:
  `h3-reference-turbo-realtime` takes `^3.0.2`, the release that serializes an
  array of uploads for its `reference_images`.
- One model per folder. The folder name is the model identifier the scaffolding
  CLI takes as `--model <name>`.
- One project per folder, installed from the root. `fast-h3-livestream` is the
  one exception and says so in its README; a template that needs a second part
  is a deliberate decision, not the default.
- Read a folder's `skill/SKILL.md` before changing it. It is where the reasoning
  behind the code lives.
