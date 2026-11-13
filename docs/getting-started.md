# Getting started with Nakoda

> Formerly **Fitrah**. Existing data in `~/.fitrah` is used in place; nothing to migrate.

Nakoda runs on your machine: a small local runtime plus a web UI in your browser. You chat with Claude inside **workspaces**, where each workspace is a git worktree on its own branch. This guide takes you from a fresh clone to your first chat.

> **Beta (v0.1.0-beta):** Claude only, macOS, one user. Codex comes after the beta.

## 1. Requirements

| Need | Check |
|---|---|
| Node 26 | `nvm install 26 && nvm use` (the repo has an `.nvmrc`) |
| pnpm 11 | `pnpm -v` |
| Claude Code, logged in with a claude.ai subscription | `claude auth status --json` shows `"loggedIn": true, "authMethod": "claude.ai"` |
| git | any recent version |

## 2. Install and start

```bash
git clone git@github.com:danangace/Nakoda.git
cd Nakoda
nvm use
pnpm install
pnpm nakoda start
```

`nakoda start` builds the UI on first run, starts the runtime on `http://127.0.0.1:4317`, and opens your browser. Stop it with **Ctrl+C**.

To get a global `nakoda` command:

```bash
pnpm link --global     # then, from anywhere:
nakoda start
```

Options: `nakoda start --port 4400`, `nakoda start --no-open` (prints the link instead of opening the browser).

Already running and you closed the tab, or want **another browser**? Run `nakoda open` (opens your default browser) or `nakoda open --print` (prints the private link to paste into any browser). A browser without that link shows "This browser isn't connected"; that's the security guard, not an error.

## 3. First-time setup

1. **Settings → General:** set the **Docs root** to your markdown folder (e.g. your Obsidian vault). Docs are shown **read-only**; you keep editing them in Obsidian. Under **Doc paths**, list your own doc locations by name (e.g. *Plan* → `plans/{yyyy-mm}/{iteration}/{feature}/{feature}.md`, *BE Proposal*, *Open Questions*); every chat is told where they are for its workspace, with `{placeholders}` filled from the workflow fields and the date. Also choose the **Workspaces folder** (default `~/nakoda/workspaces`) and where Nakoda opens (**Open Nakoda in**: your default browser or a Chrome profile).
2. **Add a project** (sidebar → **Add project**):
   - **Browse folder:** pick an existing git repo. Nakoda has its own folder browser: click into folders, or type / paste a path and press Enter.
   - **Clone from URL:** a git URL + the folder to clone into.
   - **Create new project:** an empty folder with `git init`.

   Then set the project's **base branch** (where new workspaces start, e.g. `origin/dev/tribe-2`) and **branch prefix** (e.g. `feat/tribe-2/`). Later, the project's settings (sidebar → project name) also hold the **setup script** (runs in each new workspace, e.g. `cp …/.env .env`, `pnpm install`, `pnpm setup:env`) and an optional archive script. Nothing is written into the repo.
3. **Settings → Accounts:** Nakoda lists the Claude logins it found (e.g. `~/.claude`, `~/.claude-work`); click **Attach**. No login yet? **Sign in a new Claude account** (a browser tab opens). ★ = default account.
4. **Settings → Models:** the short list shown in the model picker, plus the default.

## 4. Workspaces

**One workspace = one git worktree on its own branch, with its chats.** Your project's main checkout is never touched.

**New workspace** (sidebar, or **+** next to a project) opens a small modal:

| Field | What it does |
|---|---|
| Project | which repo |
| Workspace name (optional) | branch = project prefix + name; empty → `ws-<date>-<time>` |
| Type | **Free chat**, or a **workflow** (e.g. Planning) whose fields you fill here |
| Agent · Model | creates the first chat (your default account and model are preselected); **No agent** is possible |
| Advanced | change the base branch for this workspace |

The modal shows the branch it will create ("Branch feat/tribe-2/x from origin/dev/tribe-2"). **⌘↵** creates it. Nakoda fetches the base, runs `git worktree add -b`, then the project's setup script (its log streams into the workspace page). The first chat **waits for your first message**.

**Archive** removes the worktree. The branch is deleted only if you tick the box; uncommitted changes ask before they are discarded.

### Workflows: no more copy-pasting the PRD

**Settings → Workflows** holds templates you define:

- **Fields** the user fills when creating a workspace. Types: **text**, **link**, **docs folder** (suggestions from your vault), **branch** (used as the base branch), **choice**. Each can be required and have a default and help text.
- **Instructions for Claude**, which can use the fields as `{Label}`, e.g. "Write the implementation plan for {Module} ({Iteration}) from the PRD ({PRD})…".

Nakoda ships an editable **Planning** workflow (PRD, Figma, Iteration, Module, Target docs, Base branch). In a workflow workspace, Claude gets the workflow, every value and the filled-in instructions **with every message**. The workspace header shows the same values (links are clickable).

## 5. Chat with Claude

In a workspace, choose **account** and **model**, then **New chat**. Claude works inside the workspace's worktree.

| Claude wants to… | Nakoda does |
|---|---|
| read files, search | runs it (no question) |
| edit a file inside the workspace | runs it (no question) |
| run a command (`pnpm`, `git`, `touch`…) | shows an **Approve / Deny** card |
| touch anything outside the workspace | shows a card |
| `git push`, `rm -rf` | **always** shows a card |

- **Stop** ends the current turn.
- Several chats per workspace: each one is a tab.
- Chats survive a restart: stop Nakoda, start it again, open the workspace, and the conversation is there and continues where it left off.

## 6. Status and notifications

- The sidebar dot per workspace shows **working** · **needs approval** · **done** · **error**, and the header counts "N working · N need you".
- Click **Enable notifications** (sidebar) to get a browser notification when a workspace needs you or finishes while the tab is in the background.
- If an account hits its Claude usage limit, a warning appears in the sidebar and on the account. Other workspaces keep working.

## 7. Where things are stored

| What | Where |
|---|---|
| Nakoda database (repos, workspaces, chats, accounts = folder paths only) | `~/.nakoda/nakoda.db` |
| Session token for the local UI | `~/.nakoda/token` (mode 600) |
| Setup logs | `~/.nakoda/logs/` |
| Accounts created by "Sign in new account" | `~/.nakoda/accounts/claude/<id>/` |
| Chat history | Claude's own transcripts in the account folder (`<account>/projects/…`); never copied |
| Worktrees | your Workspaces folder |

Nakoda never stores tokens or credentials, and removes `ANTHROPIC_API_KEY`-style variables before starting Claude, so the subscription login is used.

## 8. Security

- The runtime listens on `127.0.0.1` only.
- Every API call needs the session token (cookie set when you open the link from `nakoda start`).
- Requests with a foreign `Origin` or `Host` are refused.

## 9. Troubleshooting

| Problem | Try |
|---|---|
| "This browser isn't connected to Nakoda" | Run `nakoda open`, or `nakoda open --print` and paste the link into that browser. |
| Account shows **logged out** | `CLAUDE_CONFIG_DIR=<folder> claude auth login`, then **Re-check** in Accounts. |
| Account shows **error** | Is `claude` on your `PATH` in the terminal where you ran `nakoda start`? |
| Workspace creation fails with "Base not found" | Check the project's base branch (or Advanced), e.g. `origin/dev/tribe-2`; Nakoda fetches it first. |
| "Fill in: …" in the Create workspace modal | The chosen workflow has required fields; fill them or choose Free chat. |
| Setup failed | Read the setup log on the workspace page. The workspace is kept; fix the problem and continue in a chat. |

## 10. Development

```bash
pnpm dev:runtime   # runtime with NAKODA_DEV=1 (allows the Vite dev host)
pnpm dev:ui        # Vite on :5173, proxies /api and /ws
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e      # Playwright smoke (fake agent, no Claude usage)
```
