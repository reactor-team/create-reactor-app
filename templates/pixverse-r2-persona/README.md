# PixVerse R2 Persona

A Next.js app for PixVerse R2 Persona on Reactor. Persona turns one portrait into a character you talk to face to face, by voice or by text, with live subtitles. It opens blank; three ready-made characters fill the setup in one click if you want to see the model work first.

```text
┌──────────────────────┬────────────────────────────────────────┐
│ ● Disconnected       │                                        │
│ [Connect]            │           the character, live          │
│ Character · presets  │                                        │
│ Portrait             │                                        │
│ Name · Voice         │                                        │
│ Persona              │                     [mic] [speaker]    │
│ [Call]               │                                        │
└──────────────────────┴────────────────────────────────────────┘
```

## Quick start

Run these commands from this folder:

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

Set `REACTOR_API_KEY` in `.env.local` before opening [localhost:3000](http://localhost:3000). Create a key at [reactor.inc/account/api-keys](https://www.reactor.inc/account/api-keys); it must be allowed to use `reactor/pixverse-r2-persona`. The server exchanges the key for a short-lived JWT scoped to that model; the browser never receives the API key. A missing key opens a setup page.

## What you can do

- **Call a character.** Upload a portrait or pick a preset, give it a name, a voice, and a persona. The play button beside the voice plays a short greeting in that voice, so you can hear it before calling. One button connects, asks for your microphone, creates the character, and starts the call. The character greets you as soon as it can hear you.
- **Talk or type.** Speak into the microphone or send a line. The answer plays on the stage with subtitles, and both sides land in the conversation.
- **Hang up and call again.** An ended call keeps the character, so the next call is one click. Mute your microphone or the speaker from the stage.
- **Save a clip.** A Save menu on the stage keeps the last seconds, or the whole session, as a clip you can watch and download from the header. Requires recording to be enabled for the model.
- **Watch the session.** The status panel shows the connection lifecycle, lets you connect before calling, and disconnects whenever you like. A refused command appears in the sidebar with the model's reason.

## How the app follows the model

| State | Model phases | Sidebar |
| --- | --- | --- |
| No call | `idle` → `creating_character` → `character_ready` / `ended` / `failed` | Character setup, then **Call** |
| In a call | `starting` → `connecting` → `live` → `ending` | The conversation and a line to type |

The app mirrors the model's `session_state` snapshot once, in `app/lib/session.tsx`, and every component reads from it. It publishes the microphone before `start_call` so the first words are heard.

## Code tour

| File | Purpose |
| --- | --- |
| [app/PersonaApp.tsx](app/PersonaApp.tsx) | Typed provider, memoized JWT resolver, page layout |
| [app/api/reactor/token/route.ts](app/api/reactor/token/route.ts) | Server-side scoped token exchange |
| [app/lib/token.ts](app/lib/token.ts) | The in-memory token resolver |
| [app/lib/session.tsx](app/lib/session.tsx) | The flow: connect, microphone, create or attach, call, say |
| [app/lib/presets.ts](app/lib/presets.ts) | The characters the app opens with |
| [app/components/](app/components) | The stage and the sidebar panels |
| [app/components/StatusBadge.tsx](app/components/StatusBadge.tsx), [app/components/CommandError.tsx](app/components/CommandError.tsx) | Connection lifecycle and the last refused command |
| [app/components/SavedClips.tsx](app/components/SavedClips.tsx) | Clip capture through the base SDK's recording helpers |

## Extend it

Read [skill/SKILL.md](skill/SKILL.md) for the typed API, lifecycle, authentication rules, and extension checklist.

The typed SDK is `@reactor-models/pixverse-r2-persona`, pinned to its exact version in `package.json`. `pnpm-workspace.yaml` exempts that version from pnpm's minimum release age, so an install on launch day resolves it. When you move to a newer version, update both.

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Reactor typed SDK · `@reactor-team/js-sdk` (recording primitives) · Reactor design tokens
