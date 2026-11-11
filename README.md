# Fitrah

**F**inance **I**teration **T**ools, **R**eview & **A**gent **H**ub: a personal agent orchestrator for doc-driven development.

You chat with Claude in git-worktree workspaces, read your markdown docs read-only, and keep the people gates (requirements, plan approval, MR approval) in your own hands. The architecture follows [Orca](https://github.com/stablyai/orca): a local runtime and a React UI that runs in the browser first.

> **Status:** pre-alpha, working towards `v0.1.0-beta` (Claude only).

## Requirements

- Node 26 (`nvm use`)
- pnpm 11
- Claude Code installed and logged in

## Development

```bash
nvm use
pnpm install
pnpm dev:runtime   # local runtime
pnpm dev:ui        # React UI (Vite)
pnpm typecheck && pnpm lint && pnpm test
```

## Layout

| Path | Purpose |
|---|---|
| `src/main/` | runtime (Node + Hono): settings, accounts, docs, workspaces, chat |
| `src/renderer/` | React UI |
| `src/shared/` | contracts shared by the runtime, the UI and the CLI |
| `src/cli/` | the `fitrah` command |

## License

MIT, see [LICENSE](LICENSE).
