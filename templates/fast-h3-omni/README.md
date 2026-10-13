# FastH3-Omni

Reactor clip generator built with the typed `@reactor-models/fast-h3-omni` SDK.
It accepts a text prompt,
ordered image and audio references, and continuation from the last generated
clip. The browser displays the model's `main_video` and `main_audio` tracks.
Its layout follows the other H3 starters: a compact composer sidebar, a large
video stage, queue status, and a continuation field. Guided scene fields turn
picture names, descriptions, and audio roles into an inspectable prompt; the full
prompt tab leaves the wording to you.
The three scene cards use local copies of Reactor's FastH3-Omni Bunny CDN
assets. Selecting one fills the prompt and loads its ordered reference pictures
into the form. Last Train Ramen also loads two voice clips. The Lighthouse
Keeper card uses its example poster as a picture reference.
The names in the guided editor are local aliases. The generated prompt binds
them to the ordered `<Picture N>` uploads with `<Subject N>` or `<Object N>`
mentions; the model API has no separate image-name field.

## Run locally

Requires Node 20.9+ and pnpm. From this folder:

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

`pnpm test` checks scene limits and guided prompt assembly. `pnpm build`
checks the app bundle.

## Typed model SDK

The example pins `@reactor-models/fast-h3-omni@0.2.0`. Its provider, typed
command methods, message hook, track hook, and video view are used in
`app/Studio.tsx`. The typed package brings in the shared JS SDK transport;
the app imports model-specific APIs only from the typed package.
