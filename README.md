# Create Reactor App

🧩 **Create Reactor App** is a CLI tool that helps you quickly bootstrap a new application using the Reactor SDK. Get started with interactive AI applications in seconds!

## Quick Start

```bash
npx create-reactor-app my-app --model=helios
```

Or with pnpm:

```bash
pnpm dlx create-reactor-app my-app --model=helios
```

## Usage

```bash
npx create-reactor-app [project-name] --model=<name> [options]
```

The model argument is required. If you omit the project name, you will be prompted for it interactively.

**Arguments:**

| Argument       | Description                                         |
| -------------- | --------------------------------------------------- |
| `project-name` | Name of the project to create (prompted if omitted) |

**Options:**

| Option          | Description                                           |
| --------------- | ----------------------------------------------------- |
| `--model`, `-m` | Model to scaffold a project for (required)            |
| `--token`, `-t` | GitHub token for private repository access (optional) |
| `--help`, `-h`  | Show help message                                     |

**Examples:**

```bash
# Project name first, model flag after
npx create-reactor-app my-app --model=helios

# Flag first, project name after
npx create-reactor-app --model=lingbot my-app

# Project name omitted — you will be prompted for it
npx create-reactor-app --model=helios

# With a GitHub token (only needed if the template repo is private)
npx create-reactor-app my-app --model=helios --token ghp_xxxxxxxxxxxx
```

### Available Models

Templates live in [`templates/`](./templates) in this repository — one runnable Next.js app per model Reactor serves on the API. By default the model name maps 1:1 to a folder of the same name (e.g. `--model=helios` clones the `templates/helios/` folder), so **a folder name there is a public identifier** and renaming one breaks the CLI.

The CLI also supports an optional alias map (`MODEL_MAP` in `bin/create-reactor-app.ts`) for cases where the public model name needs to differ from the folder name. It is empty by default — add an entry only when you want a name → folder rename.

Run the CLI without `--model` to see the list of available models in the templates repo. The output lists explicit aliases first (with the resolved folder shown after `→`) and then any remaining unmapped folders.

### Private Repository Access

While this repository is private, `npx create-reactor-app` cannot read the template list or clone anonymously, so it prompts for a GitHub token. Pass `--token` (or `-t`) to skip the prompt. Once the repository is public the token is no longer needed and both paths work unauthenticated.

## Getting Started After Creation

After creating your project:

```bash
cd your-project-name
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see your application running. Make sure to setup your API keys first!

## Templates

Every template lives in [`templates/`](./templates), which has its own README covering what each one demonstrates, the auth model they all share, and the one behaviour of `@reactor-team/js-sdk` 3.x that is easy to get wrong. Each folder also carries a `skill/SKILL.md` written for someone extending it.

The CLI resolves templates from this repository's **default branch**, not from the installed package, so a template fix reaches users as soon as it merges — no release required. A change to the CLI itself still needs a release.

## Documentation

For comprehensive guides, API references, and tutorials, visit the official Reactor documentation:

📚 **[Reactor Documentation](https://docs.reactor.inc)**

## Requirements

- Node.js 16 or later
- pnpm (recommended) or npm

## Local Development

To test or develop the CLI locally:

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Link it globally
pnpm link --global
```

Now you can use `create-reactor-app` anywhere on your system:

```bash
create-reactor-app my-app
```

To unlink when you're done:

```bash
pnpm unlink --global
```

## Releasing

Publishing to npm is automatic: bump `version` in `package.json`, merge to
`main`, then [create a GitHub Release](https://github.com/reactor-team/create-reactor-app/releases/new)
tagging that version. The [`publish` workflow](.github/workflows/publish.yml)
builds and runs `npm publish` for you via npm's trusted publishing (OIDC) —
no token to manage. It no-ops if that version is already on the registry, so
re-running a release is always safe.

## License

[Apache 2.0](./LICENSE) © 2024-2026 Reactor Technologies, Inc.

## Support

- 📖 [Documentation](https://docs.reactor.inc)
- 💻 [Templates](./templates)
- 🐛 [Report Issues](https://github.com/reactor-team/create-reactor-app/issues)

---

**Happy building with Reactor! 🚀**
