# Genie 4 World explorer

Explore a place you describe with Google DeepMind Genie 4 on Reactor. Start
from text, your own image, or both; walk through the world, hear its sound,
and change the scene with instructions. Each world runs for up to a minute.

```text
┌─────────────────────┬──────────────────────────────────┐
│ Connect / status    │                                  │
│ Image gallery       │          World video             │
│  or movement +      │                                  │
│  live instructions  │                                  │
│ Clip capture        │                      Sound toggle│
└─────────────────────┴──────────────────────────────────┘
```

## Quick start

From this folder:

```bash
cp .env.example .env.local # add REACTOR_API_KEY to .env.local
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Get a key with Genie 4 access at
[Reactor API keys](https://www.reactor.inc/account/api-keys). The key stays on
the server; the browser receives only a model-scoped session token.

## What you can do

- **Create a world in one click.** Click a gallery image: the app connects,
  uploads that opening image and starts its world automatically. For your own
  prompt or image, use the always-visible controls below the gallery and click
  **Start world**.
  Prompts can contain up to 2,000 characters.
- **Bring an opening image.** PNG, JPEG and WEBP files are accepted up to
  20 MiB and 40 megapixels. Landscape 16:9 works best; other shapes are cropped.
  Clear the prompt to start from an image alone. Selecting a custom file preserves
  your prompt and uploads only when you click Start.
- **Explore.** Hold WASD to move, arrow keys to look, and Space or E for actions.
  The on-screen buttons support pointer holds. Releasing the key or pointer,
  switching tabs, or leaving the window releases movement.
- **Listen.** Sound plays by default. Use the speaker control in the video
  to mute or unmute. If your browser blocks playback, click **Enable sound**.
  A connected session can be silent before a world starts.
- **Change the scene.** While live, send a short instruction such as
  “It starts to snow” or ask someone in the scene to speak.
- **Start again.** End a world or let its countdown finish. The connection
  stays open, ready to start a new world with your selected inputs.
- **Try a clip.** When session recording is available, **Snap a clip** requests
  the last 10 seconds with video and sound. Preview and download the MP4 while
  the link is valid. Recording failures appear inline. Recording availability depends on the
  deployment.

## Architecture at a glance

| Phase               | Controls                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Disconnected        | Click a gallery image or custom Start to connect and launch; manual Connect is available |
| Idle, ended, failed | Prompt, optional opening image, Start                                                    |
| Starting            | Movement; End                                                                            |
| Live                | Movement, instructions, countdown; End                                                   |
| Ending              | Wait for the next opening scene                                                          |

The full `session_state` snapshot drives the UI. Components clear it on
disconnect and request a fresh snapshot on connection. Ending a world keeps
the session open; disconnecting closes the connection.

## Code tour

| File                                                  | Purpose                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| [Genie4App.tsx](app/Genie4App.tsx)                    | Typed provider and component layout                                        |
| [token.ts](app/lib/token.ts)                          | Shared in-memory token resolver                                            |
| [Token route](app/api/reactor/token/route.ts)         | Server-only model-scoped JWT exchange                                      |
| [WorldStarter.tsx](app/components/WorldStarter.tsx)   | One-click gallery launch, custom inputs, image validation/upload and retry |
| [WorldControls.tsx](app/components/WorldControls.tsx) | Held keys, instructions, countdown and end                                 |
| [WorldView.tsx](app/components/WorldView.tsx)         | Video and automatic audio with an in-player mute control                   |
| [Connection.tsx](app/components/Connection.tsx)       | Connection controls and visible SDK errors                                 |
| [SnapClip.tsx](app/components/SnapClip.tsx)           | Generic clip request, preview and download                                 |
| [UI primitives](app/components/ui/index.ts)           | Reactor buttons, panels, labels and focus treatment                        |
| [prompts.ts](app/lib/prompts.ts)                      | Gallery images, suggested places and scene changes                         |

## Going further

Read [skill/SKILL.md](skill/SKILL.md) before adding controls. Extensions include
shared sessions, a custom full-session recording flow, and longer-visit token
renewal bound to an existing session. Worlds cannot pause or resume.

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · typed
`@reactor-models/genie-4` · `@reactor-team/ui` design tokens ·
`@reactor-team/js-sdk` recording primitives · `hls.js` clip playback.
