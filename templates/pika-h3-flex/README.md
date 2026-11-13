# Pika H3 Flex

Reactor live video stream built with the typed `@reactor-models/pika-h3-flex` SDK.
It turns a text prompt, with either ordered reference images and audio or a
pinned first and last frame, into video clips with their own soundtrack, and
continues each clip from the last. The browser displays the model's
`main_video` and `main_audio` tracks.

Pika H3 Flex v3 runs both of Pika's adapters in one service and picks one per
clip from what you send: first and last frames, a prompt alone, or a frame
continuation build on **FL2VA**; reference pictures and audio, or a latent
continuation, build on **Ref2VA**. No field chooses; each clip reports the one
it used in `clip.adapter`.

Describe a scene, optionally attach reference pictures and audio, and press
Generate: the clip plays in the stream as soon as it is built. Each next clip
can continue the previous one, and the queue can be reordered and trimmed.
The session stays open between clips, so you can keep sending prompts and
they queue up behind the one playing. What to queue next, and how, is left to
you: the app is a starting point for your own harness, not a director.

The layout follows the other H3 starters: a composer sidebar for building and
one stage for watching the stream. Describe
the clip and name your reference pictures and audio. The **Sent to Pika**
panel shows the exact prompt as it builds, with the reference lines Pika
expects. Type in it to take the prompt over yourself.

Four scene cards show the four shapes of request:
- **Treehouse:** an animated scene from text alone, in one shot.
- **Product reveal:** one product picture, cut into three shots with a narrator.
- **Sitcom:** three character pictures and a set, talking to each other.
- **Food truck:** two characters, each with their own voice clip.

The pictures were generated for this template and the voices made with
ElevenLabs.

Reference audio unlocks once a picture is attached, because the model takes
audio only beside a picture or a latent continuation.

### First and last frame

Instead of references, a clip can pin its **first frame**, its **last
frame**, or both. Each is centre-cropped to the canvas. Frames never share a
clip with reference pictures or audio, so the composer locks one side while
the other is in use; the model refuses the combination with `invalid_request`,
and the app shows that refusal in words. The model never adds Pika's
alignment line itself, so the **Sent to Pika** panel opens with the one
Pika's guide gives for the frames attached, for example:

```text
How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the 0.00-second mark of the target video; <Picture 2> (from [Shot 1]) aligns with the 10.00-second mark of the target video.
```

### Continuing a clip

Once a clip is queued, choose how the next one continues it:

- **Frame** (default): the next clip opens on the previous clip's last frame,
  so the picture doesn't jump at the cut. It takes no references and carries
  no sound, so the app describes the scene in words and the sound starts
  afresh. The previous clip can still be building: the model waits for it,
  so you can queue the next beat right away and the clips play back to back.
- **Latent:** the previous clip's last 2.33 seconds of picture and sound carry
  over, and the scene's references stay. The previous clip must have finished
  building, so "Continue this scene" waits for it.

The choice applies to "Continue this scene". The app also turns
`flush_on_clip_end` off, so the stream holds the last frame instead of going
black while the next clip is on its way.

### Live mode (optional, bring your own LLM)

Set an LLM in `.env.local` and a **Live director** panel appears once the
first clip is queued. **Go live** and it keeps writing the next clip from the
opening scene, the last few clips and your direction, so the stream runs on
its own. Type in its box and **Send to the next clip** to steer: it drops the
prompt it was writing and writes the next one from your direction, without
resetting, stopping playback or clearing the queue.

```sh
LLM_PROVIDER=anthropic   # or openai
LLM_API_KEY=...          # stays on the server; the browser never sees it
LLM_MODEL=               # optional: claude-haiku-5-5 / gpt-5.4-mini by default
LLM_BASE_URL=            # optional: any OpenAI-compatible endpoint
```

It writes one clip ahead: clip N+1 is written while clip N builds, and in
frame mode it is queued at once. It stops writing while two clips already
wait ahead of playback, so a new direction reaches the screen about one clip
later. It pauses after 20 clips, or with the reason on any LLM or model
error. Pausing stops the writer and turns autoplay off. With no LLM set, the
app is the manual "Continue this scene" flow above.

### Length and resolution

The lengths come from the session (`state_update.clip_seconds_choices`, 25
values from 5 to about 15 seconds), never a hardcoded list: the model refuses
any other value rather than rounding it. Before a session exists the composer
offers **15.083 seconds**, the longest and the model's own default. A clip
builds in about 10 seconds, so a continued stream keeps up only when each clip
plays longer than that. Resolution is **768p** (default) or **480p**, faster to build, and
like the aspect ratio it can change only while the session is empty
(`set_resolution` in `valid_commands`).

### Reference videos (experimental, not in this app)

The model also takes up to three reference videos (`reference_videos`, 2–15
seconds each, 15 seconds together, at most 64 MiB, aspect 1:4 to 4:1). A
video's soundtrack conditions the clip with it. They are experimental, so
this app leaves them out of the composer; see `enqueue` in the typed package
to add them.

## Run locally

Requires Node 20+ and pnpm. From this folder:

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://127.0.0.1:3000. With no API key, the app shows setup instructions.
Set `LOCAL_PREVIEW=1` in `.env.local` to inspect the full app layout without
connecting or generating. To generate, set `REACTOR_API_KEY` in `.env.local`,
then restart the server. The API key stays on the server; the browser receives
a scoped session token. The token route imports `MODEL_NAME` from the typed
package, so its scope matches the model provider.

`pnpm test` checks scene limits, the prompt token estimate, the automatic prompt
assembly, including first/last-frame alignment lines and frame continuations.
`pnpm build` checks the app bundle.

## Going further

Read [`skill/SKILL.md`](skill/SKILL.md) before changing anything. It covers the
queue contract, Pika's media and prompt limits, refusals, the auth rules, and
the controls left out on purpose.
