# PixVerse R2 Director

A Next.js app for PixVerse R2 Director on Reactor. Director turns a description and a few reference images into a short film: list the shots, press Generate, and the film builds in front of you, each shot continuing from the last frame of the one before. It opens blank; three ready-made films fill the setup in one click if you want to see the model work first.

```text
┌──────────────────────┬────────────────────────────────────────┐
│ ● Disconnected       │                                        │
│ [Connect]            │              the film, live            │
│ Film · presets       │                                        │
│ Reference images     │                                        │
│ Style · Orientation  ├────────────────────────────────────────┤
│ Shots                │ Shots   [1 playing][2 ready][3 queued] │
│ [Generate]           │                                        │
└──────────────────────┴────────────────────────────────────────┘
```

## Quick start

Run these commands from this folder:

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

Set `REACTOR_API_KEY` in `.env.local` before opening [localhost:3000](http://localhost:3000). Create a key at [reactor.inc/account/api-keys](https://www.reactor.inc/account/api-keys); it must be allowed to use `reactor/pixverse-r2-director`. The server exchanges the key for a short-lived JWT scoped to that model; the browser never receives the API key. A missing key opens a setup page.

## What you can do

- **Generate a film.** Describe your own or pick a preset, add up to six reference images (the first one opens the film), choose a style and an orientation, and list the shots. Generate connects, sets up the film, and queues the shots as 10 second clips. Playback starts by itself once 30 seconds of shots are ready, so they play in order without a gap.
- **Add the next shot.** Type what happens next and how the view moves. Pick a length from 5 to 10 seconds, or start from one of the film's reference images instead of continuing the last shot.
- **Manage the reel.** Every shot of the run sits under the stage with its status. Play a ready shot by hand, remove a queued one, or stop the one playing.
- **Start over.** New film ends the run, clears what was built, and brings the setup back; an unchanged film is attached again rather than created twice.
- **Save a clip.** A Save menu on the stage keeps the last seconds, or the whole session, as a clip you can watch and download from the header. Requires recording to be enabled for the model.
- **Watch the session.** The status panel shows the connection lifecycle, lets you connect before pressing play, and disconnects whenever you like. A refused command appears in the sidebar with the model's reason.

## How the app follows the model

| State | Model phases | Sidebar |
| --- | --- | --- |
| No film | `idle` | Film setup, then **Generate** |
| Film set | `creating_world` → `world_ready` → `starting` → `generating` → `ended` / `failed` | Next shot, length, start from |

The model calls the film's setting a *world*: `create_world` takes the description, reference images, style, and orientation, and every clip is generated inside it. The shot list is this app's own: Generate sends one `enqueue` per shot. The app mirrors the model's `session_state` snapshot once, in `app/lib/session.tsx`, and every component reads from it. It turns autoplay on once 30 seconds of shots are ready, so they play in order without stalling.

## Code tour

| File | Purpose |
| --- | --- |
| [app/DirectorApp.tsx](app/DirectorApp.tsx) | Typed provider, memoized JWT resolver, page layout |
| [app/api/reactor/token/route.ts](app/api/reactor/token/route.ts) | Server-side scoped token exchange |
| [app/lib/token.ts](app/lib/token.ts) | The in-memory token resolver |
| [app/lib/session.tsx](app/lib/session.tsx) | The flow: connect, create or attach the world, queue the shots, play |
| [app/lib/presets.ts](app/lib/presets.ts) | The films the app opens with |
| [app/components/](app/components) | The stage, the shot reel, and the sidebar panels |
| [app/components/StatusBadge.tsx](app/components/StatusBadge.tsx), [app/components/CommandError.tsx](app/components/CommandError.tsx) | Connection lifecycle and the last refused command |
| [app/components/SavedClips.tsx](app/components/SavedClips.tsx) | Clip capture through the base SDK's recording helpers |

## Extend it

Read [skill/SKILL.md](skill/SKILL.md) for the typed API, lifecycle, authentication rules, and extension checklist.

The typed SDK is `@reactor-models/pixverse-r2-director`, pinned to its exact version in `package.json`. `pnpm-workspace.yaml` exempts that version from pnpm's minimum release age, so an install on launch day resolves it. When you move to a newer version, update both.

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Reactor typed SDK · `@reactor-team/js-sdk` (recording primitives) · Reactor design tokens
