# Agent instructions for create-reactor-app

This repository holds two things: the `create-reactor-app` CLI in `bin/`, and
the templates it scaffolds in `examples/`. Everything here is public-facing —
readers copy these templates verbatim into their own products.

## Contribution policy

Never commit, push, or open a PR without explicit permission from a human
maintainer in the current conversation. Treat creating or updating a remote
branch as publishing.

## How the CLI finds a template

`bin/create-reactor-app.ts` lists `examples/` through the GitHub Contents API,
shallow-clones this repository, moves the chosen folder's contents up to the
destination, and deletes the rest. Two consequences worth holding on to:

- **A folder name in `examples/` is a public identifier**, the `--model <name>`
  a reader types. Renaming one breaks that command for everyone. `MODEL_MAP` in
  `bin/lib.ts` exists for the case where a public model name has to differ from
  its folder; it is empty because every name currently maps 1:1.
- **Templates resolve from the default branch, not the published package.** A
  template fix ships the moment it merges. A change to the CLI itself needs a
  release: bump `version`, merge, then cut a GitHub Release, which publishes to
  npm over OIDC.

Templates are deliberately excluded from the npm tarball (`files` in
`package.json`) — they are ~30 MB, which is why the CLI fetches them by clone.
`.prettierignore` skips `examples/` too, because each template is formatted to
its own conventions rather than the CLI's.

## Rules for a template

The authoring standard is the `scaffold-model-example` workflow in
[reactor-team/ai-skills](https://github.com/reactor-team/ai-skills). Read it
before adding a folder. The rules that matter most often:

- **`skill/SKILL.md` is part of the deliverable.** It is written for someone
  who has cloned the folder and wants to extend it, and it is what agents read.
  A change that leaves the skill describing the old behaviour is incomplete,
  because a stale skill actively teaches the wrong thing.
- **Auth is a server-side API key exchanged for a session-scoped JWT.** The
  route returns `{ jwt, expires_at }` under `Cache-Control: private, no-store`
  and scopes the token with `authorization_details` naming the
  account-qualified model the provider connects with. The client memoizes the
  token in module scope until shortly before expiry and fetches with
  `cache: "no-store"`.

  Both halves are load-bearing. Reactor binds a session to the token that
  created it, so the resolver must return the _same_ token for a session's
  whole life; leaning on the browser HTTP cache for that fails the moment it
  misses, because the refetched token has no sessions bound and every later hop
  403s. Never mint an unscoped token for a browser — that hands out the API
  key's full access. Do not introduce a third-party identity provider: a
  refreshed identity token has the opposite lifetime rule.

- **A command's result belongs on the awaited call, not on a subscription.**
  `@reactor-team/js-sdk` 3.x delivers a handler's answer to the connection that
  asked, correlated by request id, so a listener on an ack fires for any call of
  that command and never on a second client in the session. Read answers off the
  await; keep subscriptions for what the model broadcasts. Which commands answer
  and where a refusal surfaces is per-model — each skill carries its own table.
- **Model-specific code comes from the typed `@reactor-models/*` package.** The
  one deliberate exception is `SnapClip.tsx`: recording is model-agnostic and
  the typed packages re-export `requestClip` and `downloadClipAsFile` but none
  of `ClipPlayer`, `ClipDownloadButton`, or `RecordingError`. The test for
  anything else: if it needs this model's events, messages, or commands, it
  belongs on the typed package.
- **Templates keep their own design system.** Copies of a shared component are
  expected to differ in styling; they must not differ in behaviour.

## Verifying a change

```bash
# the CLI
pnpm install && pnpm build && pnpm test && pnpm format:check

# a template (tsc --noEmit runs inside next build)
cd examples/<model> && pnpm install && pnpm build
```

Static checks miss the things these templates exist to demonstrate, so also run
the app: connect, drive it, disconnect mid-run and reconnect to confirm no stale
snapshot survives, unset `REACTOR_API_KEY` and confirm the setup landing renders
instead of a 500, and take a clip through to a saved file.
