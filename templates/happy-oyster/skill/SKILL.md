---
name: building-happy-oyster-frontends
description: Extend this cloned HappyOyster example app - add worlds, acting characters, controls, or UI on top of the typed `@reactor-models/happy-oyster` without breaking the patterns the existing code uses. Covers the per-session Adventure/Directing/Acting modes, the connect → createWorld/attachWorld → startTravel lifecycle, the authoritative world_state snapshot, the Adventure held-input model and Directing transport, and the getJwt auth route.
---

# Building on this HappyOyster app

You've cloned this folder and want to extend it: a new world, a new control, a different UX. This guide is the map: the patterns the code already uses and the rules that keep additions native instead of bolted on. Read it alongside the source, especially [The client surface](#the-client-surface) and [The lifecycle](#the-lifecycle-and-why-its-phase-driven) before touching anything.

## What HappyOyster actually is, in three sentences

HappyOyster is a **real-time interactive world model**. You build a world from a prose prompt (an **Adventure** world you drive like a game, or a **Directing** world you steer with text), then **travel** it, streaming live video you keep influencing. Worlds are permanent account assets; a session is a viewport onto one current world at a time.

## World mode is fixed per session (read this first)

Each experience is its own Reactor model — `happy-oyster-adventure` (walk it, movement controls) and `happy-oyster-director` (steer it, text instructions). **The mode is chosen before connecting and is fixed for the life of the session.** This one fact shapes the app's structure:

- [`HappyOysterApp`](../app/HappyOysterApp.tsx) owns the pending `WorldIntent` **above** the provider, because the intent's `mode` decides which model the session connects to. It mounts `<LiveClientProvider mode={mode} key={mode}>`, so picking a world of the other experience remounts a fresh session.
- Every `WorldIntent` carries a `mode` (`"adventure" | "directing"`). The create params carry only that mode's own knobs (perspective for Adventure; resolution/layout/narrative for Directing) — never a mode field.
- A world only attaches through its own experience's model. Attaching a Directing world to an Adventure session is rejected with `MODE_MISMATCH`, which is why the attach-by-id surface asks for the experience.

## Acting through the standard generated SDK

The selector groups **Acting** beside Adventure and Directing in the existing `happy-oyster` template. Adventure/Directing keep the verified published `@reactor-models/happy-oyster@1.0.1` facade and world-only `WorldIntent`. Acting uses the standard `js-sdk-codegen` output, `@reactor-models/happy-oyster-acting`, targeting `reactor/happy-oyster-acting`. Do not add Acting to the handwritten world facade or modify `happy-oyster-demo` for this capability.

`AvatarExperience` mounts `HappyOysterActingProvider` from `@reactor-models/happy-oyster-acting/react`, with stable `jwtToken={fetchToken}` and `connectOptions={{ autoConnect: false }}`. `useHappyOysterActing()` exposes typed commands plus stock status, sessionId, lastError and tracks. Generated `useHappyOysterActing{Message,SessionState,CommandError,PerformanceEnded}(handler)` hooks subscribe to broadcasts; `SessionState` is not a zero-argument snapshot getter. Model constants and protocol types come from `/core`; alias `MODEL_NAME` for the scoped server token route. Neither `mode="acting"` nor `useHappyOyster("acting")` belongs to this API.

`ActingSession.tsx` is frontend view state, not an SDK fork: it calls the generated handler hooks, mirrors the authoritative snapshot/error, and clears them on disconnect. Its small `session-view.ts` store provides synchronous observation for the combined setup flow. Awaited `getState()` replies update the display only if their connection epoch still matches and no newer broadcast has arrived. Awaited `endPerformance()` replies are epoch-guarded too. The SDK owns transport/media lifecycle; do not patch its provider or suppress lifecycle errors here.

The Acting dependency is the verified published **exact** `@reactor-models/happy-oyster-acting@0.1.0`, with its matching `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml` and regenerated lockfile. The actual registry package (SHA256 `5c8bb3650a13602bb76dc290a5f5a6488c069a7fe4de855c0e4295b53fe08311`) was checked independently. Keep the public folder `happy-oyster` unchanged; internal `avatar/` names are implementation identifiers and the capability label is Acting.

The stock provider currently fails ordinary browser-task React19 StrictMode replay/teardown with a disposed-instance error on both base SDK3.0.2 and3.3.0, with zero network/connection/token calls. Passing production, non-Strict, or `act()`-scheduled checks does not clear that shared SDK gate. Do not disable StrictMode, alter generated output, or add a per-model workaround. This is independent of backend `MEDIA_LOST / ERR_PUBLISH_INVALID` and the common generator's nullable-enum narrowing: generated `resolution`/`aspect_ratio` accept omission or concrete enum values, not null. Keep all three limitations explicit.

### Editable Acting presets

`components/happy-oyster/avatar/lib/prompts.ts` exports `AVATAR_PRESETS`, with a stable key, name, style, image path, prompt, resolution, and aspect ratio for each example. The two live examples are the photorealistic café friend and original cartoon axolotl. Observatory has been removed; the museum guide belongs in the separate documentation example. `public/images/README.md` records asset provenance.

`ConnectionPanel.tsx` and `ExampleTile.tsx` supply the shared connection row and thumbnail presentation for all three modes. Keep their behavior and appearance consistent. Acting shows examples above creation and attach-by-ID panels; there is no create/saved tab that hides the gallery. The ID input begins empty. Character IDs are copy/paste only; do not cache them in browser storage or add a save/restore control. Thumbnails use non-draggable horizontal cover crops; full original PNGs and selected-image previews retain their own aspect ratio. Cropping a thumbnail does not make a portrait upload valid for a landscape character.

`AvatarExperience` owns the selected creative preset; `Character` loads its full PNG into the selected-file state, with a visible preview and filename, and fills its prompt/defaults. It never auto-creates a character. `Performance` offers a free-text direction field; it has no preset direction suggestions. Selecting a new preset cannot mutate an existing character — the user must create a new one. Attaching an existing ID restores the model's own character; the selected creative preset does not describe that attached character.

Do not embed another account's IDs, auto-regenerate characters, or add a character registry. Each cloned app uses the developer's key and the existing create/attach/copy-and-paste flow. Keep bundled images unchanged unless an explicit image-editing workflow replaces them.

### Acting lifecycle and media

`connect → createCharacter / attachCharacter → session_state.phase=ready → startPerformance → live ↔ paused → endPerformance → ended`.

The explicit **Create and start** / **Start character** actions run connection, setup, authoritative readiness, and one start together. `avatar/lib/character-flow.ts` subscribes before sending setup, requires both the acknowledgement and a fresh ready snapshot for the intended character, and stops on refusal, failure, cancellation, timeout, or session change. It never retries automatically or starts from an acknowledgement alone. Keep the manual start disabled during this setup flow. Disconnect and mode changes prevent a pending flow from starting another performance.

`avatar/lib/opening-image.ts` validates uploaded size/shape before connection. The source chooser shows one file or URL; preset selection visibly loads its original PNG. A copied same-origin preset URL (including an allowlisted `/_next/image` preview) is converted to an original-file upload. Never fetch an arbitrary local URL or pass a localhost preview upstream. Other local/private URLs produce an actionable upload error; the service still validates remote URLs.

`createCharacter` requires a prompt plus exactly one uploaded `first_frame_image` or public `first_frame_image_url`. Supported resolution values are `480p`/`720p`, aspect ratios `9:16`/`16:9`. Acting accepts uploaded images from 1 byte to 30 MiB (independent of the world facade’s 2 MB limit). Creation acceptance does not mean the character is ready; wait for the snapshot. Attachment restores the character's saved settings. Character IDs are separate from Adventure/Directing world IDs. The app does not persist character IDs or tokens in browser storage. `Performance` copies the current ID through the clipboard API; `Character` uses only the ID the user pastes.

`Stage.tsx` uses `HappyOysterActingMainVideoView` from the generated `/react` entry, with `audioTrack="main_audio"`, `muted={false}`, `videoObjectFit="contain"` and container styling. The generated view delegates autoplay/inline playback to the stock SDK; controls/progress remain in the left sidebar. No inbound microphone/camera tracks are declared. A `live` snapshot does not prove frames are fresh; the UI also checks `last_frame_age_ms`. Screens use the single frontend snapshot in `ActingSession`, gate on connection status, and clear it on disconnect. Refusals appear through generated `command_error` subscriptions / snapshot `last_error`; native send-command failures can also be on stock `lastError` with `operation: "sendCommand"` and belong in the command-error panel. Connection failures remain separate. Never infer success solely because an ack-only method resolved undefined: failures may resolve undefined too.

| Acting command                       | Result handling / precondition                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `createCharacter`, `attachCharacter` | Completion has no payload; observe `session_state` and visible errors. Avoid while building or performing.                      |
| `startPerformance`                   | Character must be ready; observe starting/live/failure snapshots.                                                               |
| `instruct({ text })`                 | Live or paused; observe instruction status/error. Text can describe actions and dialogue, with no guaranteed exact spoken line. |
| `pause`, `resume`                    | Gate on live/paused respectively; verify actual media resumes as well as the phase.                                             |
| `endPerformance`                     | Read the awaited `performance_ended` reply.                                                                                     |
| `getState`                           | Read the awaited `session_state`; the frontend applies it with epoch/newer-broadcast guards.                                                    |

`command_error` and `session_state.last_error` appear in `CommandError.tsx`. Failures such as `MEDIA_LOST` must remain visible and retryable where the model allows it. Do not infer capacity from a generic media failure. Existing deployment issues include intermittent startup and media failing to recover after resume. Keep these as validation blockers rather than claiming success from state changes alone.

Happy Oyster does not support recording. The example includes no capture controls, clip preview/download flow, or recording adapter. Do not add these based only on generic SDK methods.

Acting currently requires the hosted API path. The existing local Adventure/Directing switch disables Acting rather than silently connecting it to the cloud.

## The client surface

Every screen talks to **one** surface (`useHappyOysterClient()` from [`components/happy-oyster/ho-client.tsx`](../components/happy-oyster/ho-client.tsx)), and never imports the SDK hook directly. That indirection keeps every screen decoupled from the SDK hook itself.

| Concept       | What it is                                                                                  | On the client surface                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Lifecycle** | Client phase `idle → connecting → connected → starting_stream → streaming → ended / failed` | `phase`, `connect()`, `disconnect()`                                                  |
| **World**     | The session's current world, from the model's snapshot                                      | `worldState` (`phase`, `mode`, `prompt`, `first_frame`, `encrypted_world_id`)         |
| **Setup**     | Make a world current                                                                        | `createWorld(params)`, `attachWorld(encryptedWorldId)`                                |
| **Travel**    | Open / close the live world stream                                                          | `startTravel()`, `endTravelSession()`, `streaming`, `maxExperienceTimeSec`            |
| **Adventure** | Held movement + world verbs (mode 1)                                                        | `hold(cmd)`, `interact(verb)`, `release(axes)`, `stop()`                              |
| **Directing** | Text steering + transport (mode 2)                                                          | `instruct(text)`, `pause()`, `resume()`, `rewind(sec)`, `travelState`, `travelStatus` |

`LiveClientProvider` (in `ho-client.tsx`) implements this surface: it mounts the real `<HappyOysterProvider mode={...}>` and adapts `useHappyOyster()` onto the surface above. Its video slot is `<HappyOysterVideo>`, the `<video>` the live world renders into.

**When you add a screen, consume `useHappyOysterClient()`, not `useHappyOyster()`.** That keeps `ho-client.tsx` the only place that touches the SDK hook directly.

## The lifecycle, and why it's phase-driven

[`use-world-session.ts`](../components/happy-oyster/use-world-session.ts) runs one `WorldIntent` through a session. It does **not** script the steps imperatively; it reacts to `phase`:

```
idle/ended/failed → connect()
connected + no world → createWorld(params)  |  attachWorld(id)
connected + world ready → startTravel()      (auto, once per intent)
```

Why: React StrictMode's phantom mount/unmount disconnects the model mid-connect, so a one-shot "run the flow" effect would strand the session. Reacting to the phase means any aborted step just gets retried on the next render. **Keep new orchestration phase-driven and idempotent**; never assume a step ran exactly once.

The model is the single source of truth: it broadcasts one `world_state` snapshot on every change, and the client mirrors it verbatim. **Render from `worldState`; never derive world state locally.** That is what keeps client, runtime, and world from drifting.

### Build cost: the shape to design around

`createWorld()` runs on the **live, connected session** and an Adventure build takes ~30s (Directing similar; the upstream cap is ~120s). `attachWorld()` on a pre-built world is **instant (no build)**. So:

- Featured worlds with a pinned `encryptedWorldId` attach (cheapest, fastest). The rest create from their prompt.
- Surface the build honestly: `worldState.phase` moves `creating → building → ready`, and the ready snapshot carries the `first_frame` and the `encrypted_world_id` you should save.

## Setup: create vs attach

- **`createWorld(params)`** takes `params.prompt` (≤2000 chars) plus the current mode's own knobs: Adventure `perspective`, or Directing `resolution` / `layout` / `narrative`. The mode is fixed by the connected model, so it is not a param. Optionally a first frame: `firstFrameImageUrl` (a public URL) **or** `firstFrameImage` (a `File`/`Blob` ≤2MB, uploaded to the session first), never both.
- **`attachWorld(encryptedWorldId)`** makes an existing world current with no build. The id is an opaque **capability** you saved from an earlier `createWorld`; there is no listing and no read-only peek. Save it (this app shows it as a copyable chip on the ready screen), and it re-opens the exact world later — through the same experience's model.

Both are **locked while a travel is live**; end the travel before re-pointing the world.

## Adventure input: held state, re-sent every chunk

The most important rule in [`AdventureControls.tsx`](../components/happy-oyster/AdventureControls.tsx): **controls are held state, not one-shot events.** HappyOyster consumes a command per generation chunk, so a single send stops applying after one chunk. The SDK owns a 300ms re-send loop: you just tell it the current held command via `hold()`, and it keeps the button applying until you `release()` it.

- **Wire DOM events to `hold` / `interact` / `release`, never per-frame.** `keydown` → `hold({ translation: "Front" })`, `keyup` → `release({ translation: true })`. Don't send on a timer; the SDK does that.
- **Chords compose.** Each key is tracked in a per-axis stack; the app resolves W+A to the protocol's `Front_Left` diagonal, Shift+W to sprint, and falls back to whatever's still held when one key releases. Push/pop the stack; don't send raw values from a new handler.
- **Clear everything on blur.** Releasing a key outside the window (cmd-tab, focus loss) never delivers `keyup`, so the app clears all axes on `blur`. Copy that guard into any new binding, or a phantom key keeps steering.
- **World verbs are advertised, not guessed.** `travelState.character_actions` / `environment_actions` list the verbs a world understands. Offer those (the app renders them as buttons); the channel accepts any string but the world no-ops most things outside its vocabulary. A verb press holds ~1200ms then releases.
- **Keyboard handlers ignore typing.** Every handler early-returns when the event target is an `INPUT`/`TEXTAREA`/contentEditable, and `preventDefault()`s handled keys so arrows don't scroll. Keep that.

## Directing transport

[`DirectingControls.tsx`](../components/happy-oyster/DirectingControls.tsx): `instruct(text)` injects a steering instruction into the **live** world (it does not rebuild). `pause()` / `resume()` gate generation; `rewind(sec)` needs the session **paused** and snaps to multiples of 4s (the server rounds down). Debounce sends and disable transport while a call is in flight; the app tracks a `busy` flag. The instruction timeline and auto-detected chapters come off `travelState` (`user_instructions`, `chapters`); render them, don't invent them.

The experience is chosen before connecting and cannot switch mid-session. The composer (and the featured tiles) pick it; the in-session control deck branches on `worldState.mode`.

## Auth: an API key server-side, a scoped JWT in the browser

Same pattern as every Reactor example, and the model documented at [docs.reactor.inc/authentication](https://docs.reactor.inc/authentication): the `rk_...` API key (`REACTOR_API_KEY`) stays server-side and is exchanged for a short-lived JWT; only the JWT ever reaches the browser. [`app/api/reactor/token/route.ts`](../app/api/reactor/token/route.ts) is a **GET** route that POSTs to Reactor's `/tokens` endpoint internally (API key in the `Reactor-API-Key` header) and returns `{ jwt, expires_at }` marked `Cache-Control: private, no-store`. Tokens live **at most 6 hours**; the server silently clamps a larger `expires_after`, which is why the response reports the `expires_at` it actually granted rather than what was asked for.

The shared `fetchToken` resolver (in `lib/reactor-auth.ts`) is handed to the SDK, which re-invokes it on every Reactor API hop, so a token aging out mid-session can't 401 uploads or renegotiation. **The resolver memoizes the token in module scope against that `expires_at` and rotates only before a new connection rather than leaning on the browser's HTTP cache** — a cache miss would mint a second token part-way through a session, and for a session-scoped token that is a 403 on the next upload or session call, since a session may only be operated by the token that created it.

## Connecting (and session-attach)

The example creates its own Reactor session: the client's `connect()` calls `ho.connect(fetchToken)`, which mints a session and syncs the first `world_state`. Nothing is stubbed. The sidebar's `StatusBadge` (the same connection panel every Reactor example puts at the top of its sidebar) exposes `connect()`/`disconnect()` directly; pre-connecting there is optional, because `useWorldSession()` connects on demand when an intent runs. If you instead need to attach to a session a backend or queue created, `ConnectOptions` (`{ sessionId, connectionId }`) is threaded end-to-end through the base `@reactor-team/js-sdk` (`Reactor.connect(jwt, options)` and the `connectOptions` prop on `<HappyOysterProvider>`); pass them by reaching the model's `connect(jwt, options)` via `useHappyOyster().model`. This example does not need that path.

## Errors worth handling

| Failure                        | Where it shows                | What to do                                    |
| ------------------------------ | ----------------------------- | --------------------------------------------- |
| Build failed                   | `worldState.phase==="failed"` | Offer "try another prompt". Worlds are cheap. |
| First-frame content policy     | action error `403005`         | Return to the composer with the message.      |
| Stale / not-yours pinned world | action error `403001`         | Show its message, drop the saved id, and fall back to the create path. Ids saved before HappyOyster's deployment move fail this way. |
| Attaching the wrong experience | action error `MODE_MISMATCH`  | Attach through the world's own mode instead.  |
| Session drop                   | `phase === "ended"`           | Leave the travel view; no reconnect here.     |

## Travel length

Size any timer from `client.maxExperienceTimeSec`, the budget granted to the live travel. An Adventure travel runs up to **2 min**; a Directing travel runs up to **3 min** and reports `null`.

The granted value lands with the streaming phase and clears when the travel ends, so `TRAVEL_SECONDS` in [`lib/worlds.ts`](../lib/worlds.ts) sizes the clock while the stream is still opening, and for Directing travels. At zero the timer ends the travel and the world stays ready for another run.

## The typed SDK

`@reactor-models/happy-oyster` is the typed SDK this example is built on, imported at `@reactor-models/happy-oyster` (the plain-JS client and types) and `@reactor-models/happy-oyster/react` (the provider, hooks, and `<HappyOysterVideo>`). It wraps the base `@reactor-team/js-sdk` 3.x with the `connect → createWorld / attachWorld → startTravel` flow, the live controls, and the video element, so screens never touch the base SDK directly.

### Where a result arrives: the call, or a subscription

The facade hides this, which is why it is worth stating before you drop below it.
The model answers a command in one of two ways:

| The model                          | Reaches you                                                                      | HappyOyster commands                          |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| **answers** the command that asked | the awaited call's return value — and the **sending** connection's subscriptions | `getCredentials`, `endTravel`, `requestState` |
| **broadcasts** to every connection | the subscription — `onWorldState`, `onTravelState`, `onActionError`              | every snapshot, and every refusal             |
| answers with **nothing**           | the await resolves `undefined`; nothing reaches a subscription                   | `createWorld`, `attachWorld`                  |

An answer is **addressed** to the one connection whose command earned it. There it
resolves the awaited call and also reaches that connection's subscriptions — but
only that connection's, and with no way to tell which in-flight call it answers.
`startTravel()` used to wait for `travel_credentials` on a subscription and match
it up by hand; reading it off the call instead is unambiguous, which is why the
facade was rewritten that way.

`requestState()` sits on both sides on purpose: its snapshot answers the call
**and** is published to `onWorldState` subscribers, because a snapshot is
authoritative however it travelled. So asking for state still refreshes every
mirror in the app.

None of these reject. A refusal resolves the call with `undefined` and arrives as
an `action_error` broadcast; the facade converts both into a thrown
`HappyOysterActionError` for you, which is the main reason to prefer
`startTravel()` over driving the low-level surface yourself.

## Adding a featured world

One entry in [`lib/featured-worlds.json`](../lib/featured-worlds.json): `key`, `title`, `mode` (1 or 2), a paragraph `prompt`, and a `gradient` for the bubble. No component changes. To make it attach instantly instead of building, add its `encryptedWorldId` to [`lib/world-pins.json`](../lib/world-pins.json) (the shipped entries are `REPLACE_WITH_...` placeholders, treated as unpinned until you drop in a real id). Keep prompts paragraph-length with explicit setting and camera framing; short prompts produce unstable worlds.

## Recording support

Happy Oyster does not allow recording. Capture and clip downloads are intentionally absent from all three experiences. Generic recording methods exposed by the SDK do not establish support for this model and should not be surfaced as optional controls. Recording validation is not a release requirement for this example.

## Brand alignment

The app maps Reactor's design tokens from `@reactor-team/ui`'s stylesheet into shadcn theme variables in [`app/globals.css`](../app/globals.css). Use the theme utilities (`bg-primary`, `text-primary-foreground`, `border-border`, `font-mono`); don't invent parallel color systems with raw hex. Don't import `@reactor-team/ui` **React** components into Server Components; the stylesheet import is all you need. The app is dark-only via the `dark` class on `<html>`.

## Common mistakes

1. **Treating controls as events.** Adventure input is held state re-sent per chunk. Pair every `hold` with a `release`, use the key stacks, and clear on blur.
2. **Deriving world state locally.** Mirror `worldState`; the model is authoritative.
3. **Bypassing the world adapter in a world screen.** World screens use `useHappyOysterClient()` so the facade stays isolated to `ho-client.tsx`. Acting screens explicitly use the typed `useHappyOyster("acting")` surface.
4. **Choosing the mode after connecting.** The mode is fixed per session; pick it before mounting the provider (the intent carries it), and remount to switch.
5. **Attaching a world through the wrong experience.** The id belongs to one mode's model; attach it through that mode or it's rejected with `MODE_MISMATCH`.
6. **Rebuilding a world to change it.** Directing steering is `instruct()` on the live world, not a new `createWorld`.
7. **Rewind while running.** It needs the session paused and snaps to 4s multiples.

## Checklist for new world components

- [ ] Consumes `useHappyOysterClient()`, not the SDK hook directly
- [ ] Interactive controls gate on `streaming` (and `worldState.phase` where relevant)
- [ ] Adventure inputs go through `hold`/`interact`/`release` with the key stacks; blur clears them
- [ ] Keyboard handlers ignore inputs/textareas and `preventDefault()` handled keys
- [ ] World state read from `worldState` / `travelState`, never derived
- [ ] Colors via theme utilities, not raw hex

## Shared token lifetime

`app/api/reactor/token/route.ts` scopes JWTs to the world model names and `MODEL_NAME` exported by the generated Acting `/core` entry (Adventure, Directing, Acting) with a bounded session budget, returning `{ jwt, expires_at }` under `Cache-Control: private, no-store`. `lib/reactor-auth.ts` coalesces no-store fetches and keeps the originating JWT for every hop of a session. `prepareToken()` may rotate a nearly expired token only before a new connection; the resolver throws on actual expiry rather than minting a new token for a live session. The world adapter and generated Acting provider use this resolver.
