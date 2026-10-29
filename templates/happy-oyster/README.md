# HappyOyster

A Next.js + TypeScript frontend for three Happy Oyster experiences on Reactor: **Adventure** worlds you explore with movement controls, **Directing** worlds you steer with text and transport controls, and **Acting** characters that act and speak in an image-conditioned scene.

```text
┌────────────────────────────────────────────────────────────┐
│ HappyOyster          Adventure · Directing · Acting         │
├─────────────────────────┬──────────────────────────────────┤
│ Connection              │                                  │
│ World / character setup │         live video               │
│ Saved world / character │      (+ voice for Acting)        │
│ Performance controls    │                                  │
│ Text directions         │                                  │
└─────────────────────────┴──────────────────────────────────┘
```

## Quick start

```bash
cp .env.example .env.local
# Set REACTOR_API_KEY in .env.local (reactor.inc/account/api-keys).
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000) and choose an experience. Switching experiences closes the previous session and opens a fresh setup screen. A missing API key shows a setup landing.

The server exchanges your API key for a session JWT scoped to the three Happy Oyster models. The browser keeps that same token for every hop of a session, including uploads. The API key stays on the server.

## What you can do

- **Adventure.** Choose a featured world, build from a prompt, or attach a saved world ID. Explore with WASD, look controls, and world-specific actions.
- **Directing.** Create or attach a world, send directions, pause/resume, and rewind while paused.
- **Acting.** Describe a character and scene, provide one opening image (upload or public URL), and choose 480p/720p and portrait/landscape. Choose the photorealistic café friend or cartoon axolotl to load a matching image and prompt.
- **Reuse a character.** Copy its character ID and paste it into the ID field, then use **Start character** in a later Acting session. Character IDs and world IDs belong to different models.
- **Direct a performance.** Start the character, send text directions including dialogue, pause/resume, or end and start again. Video and voice play together; there is no microphone input or guaranteed verbatim speech control.

Character creation can take several minutes. The current Acting deployment has shown intermittent startup failures and media recovery issues after resume; these remain open validation blockers. Happy Oyster does not support recording or clip downloads.

The café friend and axolotl assets, prompts, and dialogue remain editable. Their names, images, scene prompts, and defaults are grouped in `components/happy-oyster/avatar/lib/prompts.ts`. Selecting a preset prepares the form and visibly selects its original PNG. **Create and start** connects if needed, uploads the image, creates the character, waits for its ready snapshot, and starts one performance. **Start character** combines connection, attachment, readiness, and start. Both actions use your own API key; selecting a preset alone makes no model call. No shared account character IDs are included.

## SDK status

Adventure and Directing keep the published `@reactor-models/happy-oyster@1.0.1` facade. Acting uses the standard generated `@reactor-models/happy-oyster-acting` client, following the other model examples. Mount `HappyOysterActingProvider` from `/react` with `jwtToken={fetchToken}` and `connectOptions={{ autoConnect: false }}`, then use `useHappyOysterActing()` for typed commands. Handler hooks receive broadcasts; `getState()` and `endPerformance()` return correlated replies on the awaited call. The token route imports Acting's `MODEL_NAME` from `/core`.

Acting installs the verified published `@reactor-models/happy-oyster-acting@0.1.0` release, pinned exactly. `pnpm-workspace.yaml` exempts only that reviewed version from the package-age gate. The registry tarball's SHA256 is `5c8bb3650a13602bb76dc290a5f5a6488c069a7fe4de855c0e4295b53fe08311`.

**Shared SDK follow-up:** the stock generated provider reproduces a React 19 StrictMode teardown error on both base SDK 3.0.2 and 3.3.0, even without a connection or token request. Production and non-Strict checks do not clear that gate. This template does not patch generated code, disable StrictMode, or add a model-specific lifecycle workaround. Backend media-startup failures remain a separate blocker.

## How it works

The experience is selected before connecting and providers are keyed by mode. The world adapter uses its existing `HappyOysterProvider`; Acting mounts its generated `HappyOysterActingProvider`. The providers are mutually exclusive, never nested. Switching experiences unmounts the previous provider and its media. The internal `avatar/` source directory is only a legacy implementation name; the product capability is Acting.

All three modes share the connection panel and horizontal example tiles. Acting keeps its example characters, creation form and paste-ID form visible together during setup. The character-ID field starts empty. IDs are copied and pasted; this app does not store them in browser storage. The Acting view uses the same wide video frame and left controls as the world views. Image uploads show the actual selected filename and preview. The horizontal preset thumbnails crop only the preview; uploads retain the full original portrait PNG and its matching shape validation. Copied same-app preset URLs (including Next image previews) resolve to the original PNG upload; other local/private image URLs ask for an upload instead.

World flows remain `connect → createWorld / attachWorld → startTravel`. Acting follows `connect → createCharacter / attachCharacter → ready snapshot → startPerformance`. Commands that return data are read from their awaited calls; `ActingSession.tsx` mirrors broadcast session state/errors for the UI and applies awaited `getState()` replies only in their originating connection epoch. A newer broadcast wins over an older reply. It resets its local view immediately on disconnect; media tracks remain owned by the stock SDK.

## Configuration

| Variable                       | Purpose                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `REACTOR_API_KEY`              | Server-only key used to mint scoped session JWTs.                                                 |
| `NEXT_PUBLIC_REACTOR_API_URL`  | Optional API URL; defaults to `https://api.reactor.inc`.                                          |
| `NEXT_PUBLIC_HO_LOCAL_RUNTIME` | `1` enables the existing Adventure/Directing local runtime path. Acting is disabled in this mode. |

## Code tour

| File                                                                                                         | Responsibility                                                    |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`app/HappyOysterApp.tsx`](app/HappyOysterApp.tsx)                                                           | Shared header, experience selector, mutually exclusive providers. |
| [`components/happy-oyster/ho-client.tsx`](components/happy-oyster/ho-client.tsx)                             | Existing world SDK adapter.                                       |
| [`components/happy-oyster/use-world-session.ts`](components/happy-oyster/use-world-session.ts)               | Phase-driven world setup and travel.                              |
| [`components/happy-oyster/avatar/AvatarExperience.tsx`](components/happy-oyster/avatar/AvatarExperience.tsx) | Acting provider and sidebar/stage composition.                    |
| [`components/happy-oyster/avatar/ActingSession.tsx`](components/happy-oyster/avatar/ActingSession.tsx) | Local broadcast snapshot, awaited reply guards, disconnect cleanup. |
| [`components/happy-oyster/avatar/Character.tsx`](components/happy-oyster/avatar/Character.tsx)               | Image input, character creation, and pasted-ID attachment.         |
| [`components/happy-oyster/avatar/Performance.tsx`](components/happy-oyster/avatar/Performance.tsx)           | Phase-gated transport, directions, and character-ID copying.  |
| [`components/happy-oyster/avatar/Stage.tsx`](components/happy-oyster/avatar/Stage.tsx)                       | Generated video/audio view; stalled-frame status stays in the sidebar.             |
| [`lib/reactor-auth.ts`](lib/reactor-auth.ts)                                                                 | Stable token resolver; rotation only before a fresh connection.   |
| [`app/api/reactor/token/route.ts`](app/api/reactor/token/route.ts)                                           | Server-only exchange scoped to the three models.                  |
| [`skill/SKILL.md`](skill/SKILL.md)                                                                           | Extension guide and command/lifecycle contracts.                  |

## Going further

Read the bundled skill before extending. Useful additions include pointer controls for Adventure and measured feedback on instruction responsiveness. Complete live media and reconnect validation before public promotion.

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Reactor typed model clients.
