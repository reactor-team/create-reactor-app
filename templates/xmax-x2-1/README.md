# XMAX X2.1

A Next.js app for streaming video editing with XMAX X2.1 on Reactor. Stream a webcam, a sample clip, or a still image; describe an edit, supply a reference image, and drag on the output to steer the subject.

```text
┌─────────────────────────┬───────────────────────────────────┐
│ Connect · Source        │ Original source  │ Edited output    │
│ Prompt · Reference      │                  │ Drag here        │
│ Drag points             │                  │                  │
└─────────────────────────┴───────────────────────────────────┘
```

## Quick start

Run these commands from this folder:

```sh
cp .env.example .env
pnpm install
pnpm dev
```

Set `REACTOR_API_KEY` in `.env` before opening [localhost:3000](http://localhost:3000). Get a production key from the [Reactor dashboard](https://reactor.inc). The server exchanges the key for a short-lived JWT scoped to `reactor/xmax-x2-1`; the browser never receives the API key. A missing key opens a setup page.

## What you can do

- **Edit your camera.** Connect, allow camera access, enter an editing instruction, and apply it. Applying another prompt changes the next generated block.
- **Edit a clip.** Choose Video and a bundled or local clip. The browser streams the playing video rather than uploading it. Use a browser supporting video `captureStream()`.
- **Animate an image.** Choose Image, select a still, and use the same image as the reference for a drag-only setup. Leave the prompt empty and click **Start Now**, then drag on the edited output.
- **Swap a subject.** Choose a reference image before applying a prompt. Preset chips only fill the prompt. Set up the source, reference image and drag controls, then click **Start Now** at the bottom to begin. During generation, **Apply prompt** sends a replacement. Changes apply from the next block without restarting generation. Expect one short output pause as the edit moves toward the new reference over the next few blocks.
- **Steer several points.** Use one mouse pointer or up to eight touch points. Positions are normalized to the visible output frame, including when the pane has letterboxing.
- **Reset and reconnect.** Reset clears the prompt, reference, and drag points. Disconnect stops the local camera; reconnect begins with fresh controls.

Still-image sources are center-cropped into a 16:9 canvas. Reference uploads retain their original image. The app does not include capture or recording controls.

## How the app follows the model

| Phase               | Model state              | Controls                                   |
| ------------------- | ------------------------ | ------------------------------------------ |
| Disconnected        | No active session        | Connect and source selection               |
| Waiting for an edit | Ready, `prompt === null` | Source, reference, prompt                  |
| Generating          | `generating === true`    | Live prompt/reference changes, drag, Reset |

The full `state_update` snapshot drives the workspace. `null` means no prompt has been set; `""` is a valid prompt for drag-only animation. The app publishes one `source` video track and renders the model's `main_video` output. The negotiated output dimensions appear below the stage.

## Code tour

| File                                                                         | Purpose                                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [app/XmaxX21App.tsx](app/XmaxX21App.tsx)                                     | Typed provider, memoized JWT resolver, workspace and lifecycle |
| [app/api/reactor/token/route.ts](app/api/reactor/token/route.ts)             | Server-side scoped token exchange                              |
| [app/lib/state.ts](app/lib/state.ts)                                         | Projects snapshots into workspace state                        |
| [app/components/useSourcePublisher.ts](app/components/useSourcePublisher.ts) | Serializes source-track publication                            |
| [app/components/SourcePanel.tsx](app/components/SourcePanel.tsx)             | Source selection, frame policy, Reset                          |
| [app/components/Stage.tsx](app/components/Stage.tsx)                         | Original and edited video panes                                |
| [app/components/PointerOverlay.tsx](app/components/PointerOverlay.tsx)       | Source-frame clock, rolling windows, pointer capture           |
| [app/components/PointerPanel.tsx](app/components/PointerPanel.tsx)           | Model-confirmed newest drag points                             |
| [app/components/ReferenceImage.tsx](app/components/ReferenceImage.tsx)       | Uploads a reference and awaits acceptance                      |
| [app/lib/examples.ts](app/lib/examples.ts)                                   | Editing-prompt presets                                         |
| [public/clips/CREDITS.md](public/clips/CREDITS.md)                           | Bundled clip provenance                                        |

## Extend it

Read [skill/SKILL.md](skill/SKILL.md) for the typed API, lifecycle, authentication rules, and extension checklist. The app uses the published [`@reactor-models/xmax-x2-1@2.0.0`](https://www.npmjs.com/package/@reactor-models/xmax-x2-1/v/2.0.0) package. Keep its exact version pin, lockfile, and `pnpm-workspace.yaml` release-age exclusion in sync when upgrading.

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Reactor typed SDK · Reactor design tokens
