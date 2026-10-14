# H3 Reference Turbo Realtime

A reference-to-video starter. Give a clip one to nine reference images and a
prompt, queue it, and play it with synchronized audio.

Model: **`reactor/h3-reference-to-video-turbo-realtime`**. "H3 Reference Turbo
Realtime" is the display name; the long string is what you pass to the SDK.

> This is not [FastH3](https://docs.reactor.inc/model-api-reference/fast-h3).
> The two have nearly the same queue-and-player commands, but FastH3 opens a
> clip from text or a keyframe and has no reference images. Both are served.

## Quick start

```bash
cp .env.example .env.local
# add REACTOR_API_KEY=rk_... from https://www.reactor.inc/account/api-keys

pnpm install
pnpm dev
```

The key stays on the server. The page mints a short-lived, session-scoped JWT
and hands the browser only that.

## Three ways in

The left rail switches between three modes. Each asks for exactly the
references it needs and nothing else.

- **1 subject, 1 shot** — one reference, a line about who it is, and a line
  about what they do.
- **2 subjects, 1 place** — a character each plus the setting they meet in,
  described separately.
- **Free style** — up to nine references and the prompt written by hand.

In the guided modes the app assembles the six-section prompt the model responds
well to, so the description you write for a reference stays bound to the
picture it came from. Free style sends your text exactly as typed.

**Every mode opens on a working scene.** The references live in
`public/presets/` and the text in `app/lib/presets.ts`, so the app generates
something the moment it loads instead of asking you to invent a subject, a
place and a shot first. Swap them for your own: a preset is a file path and
three or four strings.

## What it does

- **Names your references for you.** Each thumbnail carries the `Picture N`
  badge the prompt uses, so the binding is visible instead of explained.
- **Plays without being asked.** Generating connects, turns autoplay on,
  uploads, and enqueues; the clip starts on its own when it is ready, and the
  stage says which of connecting, uploading, or generating you are in.
- **Continues a scene shot by shot.** The box under the video asks what should
  happen next, and one line is enough: the references and their descriptions
  carry over. The clip picks up the last one's motion, camera, and audio
  through `continue_from_clip_id` rather than cutting. Queue the next beat
  while the current one plays and they run back to back.
- **Says why a command was refused.** A full queue or a bad reference fails
  the call that sent it, and the model's reason shows above the stage, apart
  from the connection status.
- **Snap a clip.** Capture the last few seconds of the session and download it.

## Code tour

| Path                             | What it holds                                                     |
| -------------------------------- | ----------------------------------------------------------------- |
| `app/page.tsx`                   | Server gate: the app, or setup instructions when no key is set.    |
| `app/H3App.tsx`                  | Provider, the memoized token resolver, and the layout.            |
| `app/api/reactor/token/route.ts` | Mints the session-scoped JWT from `REACTOR_API_KEY`.              |
| `app/lib/model.ts`               | Short names for the typed SDK's symbols, plus the canvas constants. |
| `app/lib/shot.ts`                | The shot model, the three modes, and the prompt builder.           |
| `app/lib/session.tsx`            | Shared state: the draft, the uploads, connect/upload/enqueue.      |
| `app/lib/command.tsx`            | `run()`: sends a command and reads a refusal off that call.        |
| `app/components/Composer.tsx`    | The left rail: mode, references, shot, controls.                   |
| `app/components/ReferenceSlot.tsx` | One labelled reference and its description.                      |
| `app/components/ShotControls.tsx`  | Length and seed pickers.                                         |
| `app/components/Stage.tsx`       | The video, its state overlay, and the transport.                   |
| `app/components/CommandError.tsx` | The latest refused command with the model's reason, and failed builds. |
| `app/components/StatusBadge.tsx` | The connection state; command refusals stay out of it.             |
| `app/components/WhatNext.tsx`    | The continuation box shown when a clip finishes.                   |
| `app/components/SnapClip.tsx`    | Clip capture; model-agnostic.                                      |

## One thing that will bite you

Reference images are pinned to a clip when you enqueue it. Uploading a new one
afterwards does not touch a clip that is already queued, building, or playing —
it applies to the next clip you send. Slot order is what binds `Picture 1`,
`Picture 2`, and so on, so the uploads happen in sequence rather than in
parallel; `skill/SKILL.md` covers the rest of the reference contract.

## Going further

Read [`skill/SKILL.md`](./skill/SKILL.md) before changing anything. It carries
the reference contract, the queue contract, continuation, the auth rules, and
the mistakes worth avoiding.

Docs:
[H3 Reference Turbo Realtime](https://docs.reactor.inc/model-api-reference/h3-reference-to-video-turbo-realtime/overview)
· [prompt guide](https://docs.reactor.inc/model-api-reference/h3-reference-to-video-turbo-realtime/prompt-guide)

## Stack

Next.js 15, React 19, Tailwind v4, TypeScript, `@reactor-team/js-sdk` 3.x.
