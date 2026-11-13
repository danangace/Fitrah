# Contributing to Nakoda

Thanks for helping! Nakoda is a small, personal-scale project, so keep changes focused.

## Setup

```bash
nvm use          # Node 26
pnpm install
pnpm dev:runtime # runtime (NAKODA_DEV=1)
pnpm dev:ui      # React UI (Vite, proxies the runtime)
```

See the [README](../README.md) and [docs/getting-started.md](../docs/getting-started.md) for the layout and how to run it.

## Before you open a pull request

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- One change per PR; describe what changed and why.
- Add or update a test when you fix a bug or change behavior.
- Use [Conventional Commit](https://www.conventionalcommits.org) style messages (`feat:`, `fix:`, `docs:` …).
- UI changes: include a screenshot.

## Reporting bugs and ideas

Use the issue templates. For security problems, see [SECURITY.md](SECURITY.md) instead of opening a public issue.

By contributing you agree that your work is released under the project's [MIT License](../LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
