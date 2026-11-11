# Getting started with Fitrah

Fitrah runs on your machine: a small local runtime plus a web UI in your browser. You chat with Claude inside **workspaces**, where each workspace is a git worktree on its own branch. This guide takes you from a fresh clone to your first chat.

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
git clone git@github.com:danangace/Fitrah.git
cd Fitrah
nvm use
pnpm install
pnpm fitrah start
```

`fitrah start` builds the UI on first run, starts the runtime on `http://127.0.0.1:4317`, and opens your browser. Stop it with **Ctrl+C**.

To get a global `fitrah` command:

```bash
pnpm link --global     # then, from anywhere:
fitrah start
```

Options: `fitrah start --port 4400`, `fitrah start --no-open` (prints the link instead of opening the browser).

Already running and you closed the tab, or want **another browser**? Run `fitrah open` (opens your default browser) or `fitrah open --print` (prints the private link to paste into any browser). A browser without that link shows "This browser isn't connected"; that's the security guard, not an error.

## 3. First-time setup (Settings)

1. **General:** set the **Docs root** to your markdown folder (e.g. your Obsidian vault). Docs are shown **read-only**; you keep editing them in Obsidian. Also set the **Workspaces folder** (default `~/fitrah/workspaces`).
2. **Repos:** add a repo by path and fill in:
   - **Setup script**: runs in every new workspace, e.g. `pnpm install && pnpm setup:env`.
   - **Feature base**: where feature branches start, e.g. `origin/dev/tribe-2`.

   Nothing is written into the repo; these settings stay in Fitrah.
3. **Accounts:** Fitrah lists the Claude logins it found (e.g. `~/.claude`, `~/.claude-work`). Click **Attach** on the one you use. No login yet? **Sign in a new Claude account**: a browser tab opens; sign in with your Claude subscription and paste the code back if the page shows one. The ★ marks the default account.
4. **Models:** the short list shown in the chat's model picker, plus the default (e.g. `sonnet`, `opus`, `haiku`).

## 4. Workspaces

**One workspace = one piece of work**: a git worktree on a new branch, with its chats.

- **New workspace** (home page): pick the repo, then **feature** or **defect**, a name (`kelola-xyz`), and the base:
  - feature → the repo's feature base (editable);
  - defect → **you choose** `origin/dev/tribe-2`, `origin/main` or a tag. Fitrah never guesses it.
- Fitrah fetches the base, runs `git worktree add -b <prefix><name>`, then the setup script, and streams its log into the workspace page.
- Your main checkout is never touched.
- **Archive** removes the worktree. The branch is deleted only if you tick the box. A worktree with uncommitted changes asks before discarding them.

## 5. Chat with Claude

In a workspace, choose **account** and **model**, then **New chat**. Claude works inside the workspace's worktree.

| Claude wants to… | Fitrah does |
|---|---|
| read files, search | runs it (no question) |
| edit a file inside the workspace | runs it (no question) |
| run a command (`pnpm`, `git`, `touch`…) | shows an **Approve / Deny** card |
| touch anything outside the workspace | shows a card |
| `git push`, `rm -rf` | **always** shows a card |

- **Stop** ends the current turn.
- Several chats per workspace: each one is a tab.
- Chats survive a restart: stop Fitrah, start it again, open the workspace, and the conversation is there and continues where it left off.

## 6. Status and notifications

- The sidebar dot per workspace shows **working** · **needs approval** · **done** · **error**, and the header counts "N working · N need you".
- Click **Enable notifications** (sidebar) to get a browser notification when a workspace needs you or finishes while the tab is in the background.
- If an account hits its Claude usage limit, a warning appears in the sidebar and on the account. Other workspaces keep working.

## 7. Where things are stored

| What | Where |
|---|---|
| Fitrah database (repos, workspaces, chats, accounts = folder paths only) | `~/.fitrah/fitrah.db` |
| Session token for the local UI | `~/.fitrah/token` (mode 600) |
| Setup logs | `~/.fitrah/logs/` |
| Accounts created by "Sign in new account" | `~/.fitrah/accounts/claude/<id>/` |
| Chat history | Claude's own transcripts in the account folder (`<account>/projects/…`); never copied |
| Worktrees | your Workspaces folder |

Fitrah never stores tokens or credentials, and removes `ANTHROPIC_API_KEY`-style variables before starting Claude, so the subscription login is used.

## 8. Security

- The runtime listens on `127.0.0.1` only.
- Every API call needs the session token (cookie set when you open the link from `fitrah start`).
- Requests with a foreign `Origin` or `Host` are refused.

## 9. Troubleshooting

| Problem | Try |
|---|---|
| "This browser isn't connected to Fitrah" | Run `fitrah open`, or `fitrah open --print` and paste the link into that browser. |
| Account shows **logged out** | `CLAUDE_CONFIG_DIR=<folder> claude auth login`, then **Re-check** in Accounts. |
| Account shows **error** | Is `claude` on your `PATH` in the terminal where you ran `fitrah start`? |
| Workspace creation fails with "Base not found" | Check the base name, e.g. `origin/dev/tribe-2`; Fitrah fetches it first. |
| Setup failed | Read the setup log on the workspace page. The workspace is kept; fix the problem and continue in a chat. |

## 10. Development

```bash
pnpm dev:runtime   # runtime with FITRAH_DEV=1 (allows the Vite dev host)
pnpm dev:ui        # Vite on :5173, proxies /api and /ws
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e      # Playwright smoke (fake agent, no Claude usage)
```
