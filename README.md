# Nakoda

**You're the captain, the agents are your crew.** A personal agent orchestrator for doc-driven engineering.

*Nakoda* comes from the Indonesian *nakhoda* (Persian *nākhudā*, "master of the ship"): the one who sets the course, reads the charts, commands the crew and has the final say. Here you set the course (PRD, Figma, iteration), the agents work from your docs, each in its own workspace, and every important step waits for you.

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
pnpm nakoda start      # builds the UI on first run, opens the browser
```

## Development

```bash
pnpm dev:runtime   # runtime (NAKODA_DEV=1)
pnpm dev:ui        # React UI (Vite, proxies the runtime)
pnpm typecheck && pnpm lint && pnpm test
```

## Layout

| Path | Purpose |
|---|---|
| `src/main/` | runtime (Node + Hono): settings, accounts, docs, workspaces, chat |
| `src/renderer/` | React UI |
| `src/shared/` | contracts shared by the runtime, the UI and the CLI |
| `src/cli/` | the `nakoda` command |

## Credits

Architecture inspired by [Orca](https://github.com/stablyai/orca) (MIT, © Lovecast Inc.).

## License

MIT, see [LICENSE](LICENSE).
