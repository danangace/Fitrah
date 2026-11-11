# Fitrah

**F**inance **I**teration **T**ools, **R**eview & **A**gent **H**ub: a personal agent orchestrator for doc-driven development.

Add your projects, start workspaces (git worktrees) with a free chat or a workflow template (e.g. Planning: PRD, Figma, iteration… sent to Claude every turn), read your markdown docs read-only, and keep the people gates in your own hands. The architecture follows [Orca](https://github.com/stablyai/orca): a local runtime and a React UI that runs in the browser first.

> **Status:** `v0.1.0-beta`: Claude only, macOS, one user. **Start here: [docs/getting-started.md](docs/getting-started.md).**

## Requirements

- Node 26 (`nvm use`)
- pnpm 11
- Claude Code installed and logged in

## Quick start

```bash
nvm use
pnpm install
pnpm fitrah start      # builds the UI on first run, opens the browser
```

## Development

```bash
pnpm dev:runtime   # runtime (FITRAH_DEV=1)
pnpm dev:ui        # React UI (Vite, proxies the runtime)
pnpm typecheck && pnpm lint && pnpm test
```

## Layout

| Path | Purpose |
|---|---|
| `src/main/` | runtime (Node + Hono): settings, accounts, docs, workspaces, chat |
| `src/renderer/` | React UI |
| `src/shared/` | contracts shared by the runtime, the UI and the CLI |
| `src/cli/` | the `fitrah` command |

## Credits

Architecture inspired by [Orca](https://github.com/stablyai/orca) (MIT, © Lovecast Inc.).

## License

MIT, see [LICENSE](LICENSE).
