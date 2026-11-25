# ABot World Halo game world

Walk a character through a generated game world, with sound, using ABot World
Halo (from Ant Group AMAP) on Reactor. Give a first frame, up to five views of
the character and a scene description, then play: walk, turn, hold actions and
switch the scene while video and audio stream. A world has no length limit; it
runs until you reset it or leave.

```text
┌─────────────────────┬──────────────────────────────────┐
│ Connect / status    │  Chunk · action · live scene     │
│ Example worlds      │                                  │
│  or first frame,    │          World video             │
│  character views,   │                                  │
│  scene, Start       │                      Sound toggle│
│ ── while playing ── ├──────────────────────────────────┤
│ Pause · Reset       │ Walk  │ Look  │ Jump · Crouch    │
│ Scene · Switch      │ WASD  │ ←↑↓→  │ Custom · Trigger │
└─────────────────────┴──────────────────────────────────┘
```
## Quick start

From this folder:

```bash
cp .env.example .env.local # add REACTOR_API_KEY to .env.local
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Get a key with ABot World Halo
access at [Reactor API keys](https://www.reactor.inc/account/api-keys). The key
stays on the server; the browser receives only a model-scoped session token.

## What you can do

- **Start in one click.** Pick one of four example worlds: the app connects,
  uploads its first frame and five character views, sets the scene and starts.
- **Build your own.** Choose a first frame (PNG or JPEG, cropped to fill
  832×480), add up to five pictures of the character in the order head, left,
  right, front, back (each at most 2:1), describe the scene and press
  **Start world**. The first chunk takes longer while the world is built.
- **Walk and look.** Hold WASD to walk and the arrow keys to turn and look up or
  down, or hold the keys under the video. Releasing a key, switching tabs or
  leaving the window stops the character.
- **Act.** Hold 1 to jump or 2 to crouch. A click on an action holds it for
  three seconds. Type a custom action and press **Trigger** (or Enter) to run it
  the same way.
- **Switch the scene live.** Once the first chunk is out, edit the scene in the
  sidebar and press **Switch scene**. It applies from the next chunk.
- **Pause, resume and reset.** Pause holds the picture and keeps everything;
  Reset ends the world and returns to setup.
- **Listen.** Sound plays by default. Use the speaker control in the video to
  mute. If your browser blocks playback, click **Enable sound**.

Every change applies from the next chunk, about 0.43 s later. Refused commands
show a readable reason under the connection status, with the model's code.

## Architecture at a glance

| State                 | Controls                                                       |
| --------------------- | -------------------------------------------------------------- |
| Disconnected          | Example world or Start connects and launches; Connect is manual |
| `idle`                | First frame, character views, scene, Start                      |
| `running`             | Walk, look and actions under the video; scene, Pause, Reset     |
| `paused`              | The same controls; input applies when resumed                   |

The latest `state_update` drives the UI. The model sends one on connect, after
every accepted command and on each chunk that applies a change.

## Code tour

| File                                                  | Purpose                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| [AbotWorldApp.tsx](app/AbotWorldApp.tsx)              | Typed provider and layout                                      |
| [world.tsx](app/lib/world.tsx)                        | Mirrors `state_update` and `chunk_complete` for every component |
| [token.ts](app/lib/token.ts)                          | Shared in-memory token resolver                                |
| [Token route](app/api/reactor/token/route.ts)         | Server-only model-scoped JWT exchange                          |
| [WorldSetup.tsx](app/components/WorldSetup.tsx)       | Examples, uploads, and the confirmed setup sequence            |
| [WorldDeck.tsx](app/components/WorldDeck.tsx)         | Walk, look and action controls under the video                 |
| [WorldControls.tsx](app/components/WorldControls.tsx) | Live scene, pause and reset                                    |
| [WorldView.tsx](app/components/WorldView.tsx)         | Video, audio and the status overlay                            |
| [Connection.tsx](app/components/Connection.tsx)       | Connection controls and readable refusals                      |
| [controls.ts](app/lib/controls.ts)                    | Keyboard map and action labels                                 |
| [refusals.ts](app/lib/refusals.ts)                    | Readable text for each refusal code                            |
| [scenes.ts](app/lib/scenes.ts)                        | Example worlds, loaded from Reactor's CDN                      |

## Going further

Read [skill/SKILL.md](skill/SKILL.md) before adding controls. The model also
takes `set_seed` and, on 2- and 4-GPU deployments, `set_resolution` (`768p`);
both are session setup, accepted only while idle.

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · typed
`@reactor-models/abot-world-halo` · `@reactor-team/ui` design tokens.
