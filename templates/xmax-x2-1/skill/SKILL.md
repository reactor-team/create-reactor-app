---
name: building-xmax-x2-1-frontends
description: Extend this XMAX X2.1 app with typed controls, source media, reference images, and four-frame drag windows while preserving its session and authentication behavior.
---

# Extend this XMAX X2.1 app

XMAX X2.1 edits a live video source using text instructions, a reference image, and drag points. This app streams camera, clip, or still-image frames into `source` and displays `main_video`. Extend it by producing source media, sending typed commands, and rendering the model's confirmed state.

## The four concepts

| Concept    | App surface                                                                           |
| ---------- | ------------------------------------------------------------------------------------- |
| Connection | `useXmaxX21()` exposes `status`, `connect`, `disconnect`                              |
| Commands   | `setPrompt`, `setPointers`, `setReferenceImage`, `reset`                              |
| Messages   | `useXmaxX21StateUpdate`, `useXmaxX21GenerationStarted`, `useXmaxX21GenerationStopped` |
| Tracks     | `publish("source", track)`, `unpublish("source")`, `<XmaxX21MainVideoView />`         |

This app pins the published `@reactor-models/xmax-x2-1@2.0.0` package. Import model types, commands, hooks, and video views from that typed package. Inspect the installed package when adding a helper; do not declare a second model client or guess generated exports.

## UI phases

```text
Disconnected → Connecting → Waiting for capacity → Ready
                                                  │
                                        setPrompt (including "")
                                                  ↓
                                              Generating
                                                  │
                                                reset
                                                  ↓
                                           Waiting for prompt
```

Generation also requires source frames. The model has no separate `start`, `pause`, or `resume` command.

| Phase                       | Visible controls                      |
| --------------------------- | ------------------------------------- |
| Disconnected                | Connect and source selection          |
| Ready, waiting for a prompt | Source, reference, prompt             |
| Generating                  | Prompt/reference changes, drag, Reset |

The example uses `connectOptions={{ autoConnect: false }}` so the visitor chooses when to connect. Set `autoConnect: true` in `XmaxX21App.tsx` for a product that should connect immediately.

## Add a control

Choose the phase first. A control must require `status === "ready"` before sending a command; use the snapshot's `generating` flag when it also requires output. Keep local drafts separate from model-confirmed state. Place the control in the workspace sidebar and let it own its visibility and error state.

| Intentionally absent   | Extension path                                                                            | Phase               |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------- |
| Saved gesture playback | Drive `setPointers({ frames })` from a recorded path, retaining four chronological frames | Generating          |
| Custom source producer | Produce a video track and pass it to the existing source publisher                        | Ready               |
| Recording              | Verify recording support, then add suitable shared media helpers                          | After output exists |

All four commands in the supplied model API already have controls. Do not add pause, seed, resolution, or other unsupported commands.

## Authentication

`app/api/reactor/token/route.ts` exchanges the server-only `REACTOR_API_KEY` for `{ jwt, expires_at }`. Preserve its `Cache-Control: private, no-store` response and session-scoped `authorization_details`, which allow only `reactor/xmax-x2-1` with a bounded `max_sessions` budget. The scoped model name must equal the provider's model name.

The module-scope `fetchToken` resolver in `XmaxX21App.tsx` memoizes one JWT until shortly before expiry and coalesces concurrent requests. It fetches with `cache: "no-store"`. A session belongs to the JWT that created it, so do not replace memory caching with HTTP caching or mint a new token on every request. The client and token route read the same API URL from `app/lib/config.ts`.

## State snapshots

`useXmaxX21StateUpdate` feeds `app/lib/state.ts`. The reducer preserves object identity when workspace values are unchanged. Drag points remain in `PointerPanel` so their updates do not change the workspace snapshot.

```tsx
useXmaxX21StateUpdate((message) => setSnapshot(message));
useEffect(() => {
  if (status === "disconnected") setSnapshot(null);
}, [status]);
```

Clear every new local snapshot on disconnect. Gate live UI with connection status as well as snapshot fields so an old session cannot leave controls visible during reconnect. `prompt === null` means no instruction has been set; `prompt === ""` is an intentional drag-only instruction. Do not use truthiness to distinguish those states.

## Commands and acknowledgments

| Typed command                            | Wire command          | Completion                                        |
| ---------------------------------------- | --------------------- | ------------------------------------------------- |
| `setPrompt({ prompt })`                  | `set_prompt`          | Accepted prompt, or `undefined` on refusal        |
| `setPointers({ frames })`                | `set_pointers`        | Newest accepted points, or `undefined` on refusal |
| `setReferenceImage({ reference_image })` | `set_reference_image` | Decoded dimensions, or `undefined` on refusal     |
| `reset()`                                | `reset`               | Bodyless completion; confirm state from snapshot  |

Await commands whose results drive a following step. The frame sampler sends each window without waiting for the previous answer so input remains tied to the source clock; errors still appear through the SDK's `lastError`.

```ts
const reference = await uploadFile(file, { name: file.name });
const accepted = await setReferenceImage({ reference_image: reference });
if (!accepted) return;
await setPrompt({ prompt: "replace the subject with the reference character" });
```

Use the awaited command reply for acknowledgments. Subscriptions belong to model broadcasts. A failed command can resolve `undefined`; the workspace watches `lastError` and shows a visible banner. Do not treat a resolved bodyless command as proof that an optimistic selection was applied.

| Broadcast            | Handling                                                              |
| -------------------- | --------------------------------------------------------------------- |
| `state_update`       | Full snapshot on connect and observable changes                       |
| `generation_started` | Optional reaction to a run beginning; dimensions also arrive in state |
| `generation_stopped` | Cover stale output; clear drafts only for `reason === "reset"`        |

The controls follow Source → Reference image → Drag points → Prompt. Preset chips only stage text; generation begins when the user clicks **Start Now**. Wait for source publishing and any reference upload to complete before enabling that button. Reference-dependent presets also require an accepted image. The button becomes **Apply prompt** during a run. For a reference-based edit, prepare the image before starting. Live reference replacements apply from the next block and emit no `generation_stopped` or new `generation_started`; the edit moves toward the new reference over the next few blocks. The block that applies the image takes longer, so expect one short output pause. Await acceptance and follow state; do not reset, which would clear the reference and prompt.

## Four-frame drag windows

`PointerOverlay.tsx` observes the published source track with `requestVideoFrameCallback`. It samples the current pointer positions once per source frame, shifts a four-entry window, and calls `setPointers`. Browsers without frame callbacks use the track's reported frame rate, falling back to the app's 24 fps sampling clock.

Each call contains exactly four arrays, oldest to newest. Each array contains zero to eight `{ x, y }` objects normalized to the output frame, with `(0, 0)` at top left and `(1, 1)` at bottom right. Pointer capture and `touch-action: none` preserve gestures across pane boundaries. Mapping accounts for `object-fit: contain` letterboxing.

```ts
await setPointers({
  frames: [
    [],
    [{ x: 0.4, y: 0.5 }],
    [{ x: 0.45, y: 0.5 }],
    [{ x: 0.5, y: 0.5 }],
  ],
});
await setPointers({ frames: [[], [], [], []] });
```

Four empty arrays end a drag. Releasing only one touch keeps the remaining touches active. The state snapshot's `pointers` field echoes only the newest frame as numeric `[x, y]` pairs; it is not the four-frame request shape. A block without a new window holds the previous window's newest positions.

## Source ownership and media

`useSourcePublisher` is the only owner publishing `source`. Input components produce and clean up tracks; never have a second component publish the same slot. The overlay observes the source without stopping it. Camera input mounts only while ready and stops on disconnect. The still-image canvas emits at a client-selected 24 fps; this does not guarantee the model's output rate.

The sample clips and reference images are bundled locally. Prompt presets in `app/lib/examples.ts` describe edits to the source. When extending them, describe what changes and use the reference consistently; do not replace a person's selected prompt when they upload an image.

## Brand and common mistakes

Use the CSS tokens from `@reactor-team/ui/styles.css` and the local components in `app/components/ui`. Importing interactive UI-library components into a server component can introduce client-hook errors.

Avoid singular `setPointer`, `active` request fields, nonempty-only prompt validation, reconstructed state from button clicks, stale snapshots after reconnect, fire-and-forget reference uploads, multiple source publishers, and assumptions that output resolution or frame rate is fixed.

## Extension checklist

- Status-gate commands and use snapshots for confirmed state.
- Await conditioning replies before dependent commands; display refusals.
- Preserve the scoped, no-store token route and memoized resolver.
- Keep exact SDK version and release-age exception synchronized.
- Verify source and output playback, disconnect/reconnect, and missing-key setup.
- Exercise empty prompts, four-frame windows, eight-touch limits, cancellation, and letterboxed coordinates.
- Verify capture request, preview, download and playback before adding recording claims.
- Run `pnpm build` and `pnpm exec tsc --noEmit`.
