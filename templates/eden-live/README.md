# Eden Live

Play a game and watch EdenLive render it as a new world in real time. Pick one
of seven built-in games, or play your own game in the browser, and reshape the
look of the world with a prompt while you play. Built on the typed SDK
[`@reactor-models/eden-live`](https://www.npmjs.com/package/@reactor-models/eden-live).

```
┌ EdenLive ────────────────────────────────────────────── REACTOR ┐
│ ┌ Session ────────┐  ┌ Generated world (main_video) ──────────┐ │
│ │ ● Connected     │  │ ● LIVE    Health ▬▬▬▬ 68  Mouse look on │ │
│ ├─────────────────┤  │                                        │ │
│ │[Built-in][Own]  │  │                           ┌ Draft ───┐ │ │
│ ├ Choose a game ──┤  │                           │ the game │ │ │
│ │ ▣ ▣ ▣  ▣ ▣ ▣    │  │                           └──────────┘ │ │
│ │ ▣ [+]           │  └────────────────────────────────────────┘ │
│ │ Desert Crossfire│  ┌ Controls ──────────────────────────────┐ │
│ │ [Pause] [Start] │  │  keyboard map             mouse look   │ │
│ ├ Scene prompt ───┤  └────────────────────────────────────────┘ │
│ ├ Your own look ──┤                                             │
│ └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Quick start

Requirements: Node.js 22.18+ (or 24), pnpm, and a Reactor API key authorized
for `reactor/eden-live`.

```bash
cd templates/eden-live
pnpm install
cp .env.example .env.local   # then set REACTOR_API_KEY
pnpm dev
```

## What you can do with it

- **Switch between two modes.** **Built-in games**: the model runs the game and
  you steer it. **Your own game**: a game runs in your browser and streams to
  the model as video.
- **Pick a built-in game.** Seven thumbnails of the games themselves: Cryo
  Crossing, Spider Hollow, Pulse Skirmish, Deepwater Shock, Kaiju Rampage,
  Arcade Duel, and Desert Crossfire. The world previews the game's opening
  scene until you start.
- **Play it.** Click the world, then hold keys. The mouse is locked for looking
  (Esc releases it); left and right buttons hold F and E. The keyboard map
  lights up what you hold and labels each key for the selected game.
- **Play your own game.** Steampunk plaza and Woodland camp are small 3D worlds
  you walk around in the corner of the stage; EdenLive renders them in the
  style of their reference image. They play even before you connect.
- **Add your own game.** The "+" tile opens a dialog that copies the own-game
  skill. Paste it into your coding agent (Cursor, Codex, Claude Code) and
  describe a game; the agent builds it and adds it as a new world.
- **Watch both views.** The generated world fills the stage and the game it
  comes from sits in the corner.
- **Change the look live.** The scene prompt sits in the sidebar, under the
  game you picked. Edit it and press Enter; the look shifts over a few seconds while you play. Upload
  your own reference image to restyle the world.
- **Follow the game.** In built-in games with health, a thin bar over the world
  shows it. When you win or lose, a result card appears, and a loss tints the
  world red. Pause, resume, or start a new world from the game's card.

## Architecture at a glance

| Phase | Snapshot | Visible |
| --- | --- | --- |
| Offline | none | Connect; your own game already plays locally |
| Preview | `started: false` | Thumbnails, preview, prompt, Start |
| Live | `started`, not paused or ended | Controls, prompt edits, Pause, Start new world |
| Ended | `ended: true` | Result card, Start new world (built-in games) |

The model's `state_update` snapshot drives everything. Each command is awaited
and its reply adopted; a refused command shows the model's reason in the error
banner. Built-in games use `set_source("game")`; your own game publishes its
canvas on `source_video` and uses `set_source("client")`. The API key stays on
the server, which hands the browser a session token scoped to
`reactor/eden-live`.

## Code tour

| File | What it does |
| --- | --- |
| [`app/components/Playground.tsx`](app/components/Playground.tsx) | Modes, layout, snapshot, command helper, connection. |
| [`app/components/Stage.tsx`](app/components/Stage.tsx) | World video with the draft inset, badge, health overlay, result card, and loss tint. |
| [`app/components/Picker.tsx`](app/components/Picker.tsx) | Thumbnail grid for games and worlds, with the "+" tile. |
| [`app/components/AddGameDialog.tsx`](app/components/AddGameDialog.tsx) | Copies the own-game skill for a coding agent. |
| [`app/components/PromptBar.tsx`](app/components/PromptBar.tsx) | Inline scene prompt; Enter applies. |
| [`app/components/ControlMap.tsx`](app/components/ControlMap.tsx) | Keyboard and mouse map. |
| [`app/components/ThreeWorld.tsx`](app/components/ThreeWorld.tsx) | Your own game: keys, reset, and the `source_video` stream. |
| [`app/components/WorldScene.tsx`](app/components/WorldScene.tsx) | The local 3D scene, physics, camera, and 1280x704 capture. |
| [`app/lib/useGameInput.ts`](app/lib/useGameInput.ts) | Built-in games: keys and pointer-lock mouse look. |
| [`app/lib/input.ts`](app/lib/input.ts) | Key and look senders, motion mapping, image limits. |
| [`app/lib/games.ts`](app/lib/games.ts) | Titles and key labels per built-in game. |
| [`app/lib/world-examples.ts`](app/lib/world-examples.ts) | The local worlds, their reference images and prompts. |
| [`app/lib/model.ts`](app/lib/model.ts) | The one import of `@reactor-models/eden-live`. |
| [`app/api/reactor/token/route.ts`](app/api/reactor/token/route.ts) | Mints the scoped, no-store session token. |

## Going further

[`skill/SKILL.md`](skill/SKILL.md) is the guide for extending the app: both
modes, the command table, state fields, error handling, and the input senders.
[`skill/own-game.md`](skill/own-game.md) says how to build a game that renders
well and add it to the app; it is the text the "+" dialog copies.

## Credits

The Steampunk plaza scene in `app/worlds/courtyard/` keeps its source notes and
license in [`SOURCE.md`](app/worlds/courtyard/SOURCE.md) and
[`LICENSE`](app/worlds/courtyard/LICENSE). The built-in game thumbnails and
parts of the own-game guide come from
[EdenLive](https://github.com/VAST-AI-Research/EdenLive) under the Apache
License 2.0; see [`NOTICE`](NOTICE).

Built with Next.js 15, React 19, TypeScript, Tailwind CSS 4, React Three Fiber,
Rapier, `@reactor-models/eden-live`, `@reactor-team/js-sdk`, and
`@reactor-team/ui` tokens.
