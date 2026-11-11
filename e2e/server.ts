/**
 * Smoke-test server: the real runtime app on temp data, with a fake agent (no Claude usage).
 * Started by Playwright (see playwright.config.ts).
 */
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { WEB_ROOT } from '../src/main/config'
import { insertAccount } from '../src/main/accounts/service'
import { ChatService } from '../src/main/native-chat/service'
import { fakeAdapter } from '../src/main/native-chat/testing'
import { createRuntimeApp } from '../src/main/server/app'
import { localHosts } from '../src/main/server/security'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../src/main/settings/store'
import { openDb } from '../src/main/sqlite/db'
import { makeRepoWithOrigin } from '../src/main/workspaces/testing'

export const E2E_PORT = 4398
export const E2E_TOKEN = 'e'.repeat(64)

const home = mkdtempSync(join(tmpdir(), 'fitrah-e2e-'))
process.env.FITRAH_HOME = join(home, '.fitrah')

const vault = join(home, 'vault')
mkdirSync(join(vault, 'notes'), { recursive: true })
writeFileSync(
  join(vault, 'README.md'),
  '---\ntags: [smoke]\n---\n# Smoke vault\n\nSee [[Second note]].\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```mermaid\nflowchart LR\n  A --> B\n```\n',
)
writeFileSync(join(vault, 'notes', 'Second note.md'), '# Second note\n\nHello from the second note.\n')

const db = openDb(':memory:')
saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: vault, workspacesDir: join(home, 'workspaces') })
const { repo } = makeRepoWithOrigin()
const extra = makeRepoWithOrigin()
// A distinct folder name, so it is easy to pick in the repo dropdown.
const extraRepo = join(dirname(extra.repo), 'extra-repo')
renameSync(extra.repo, extraRepo)
writeFileSync(join(import.meta.dirname, '.state.json'), JSON.stringify({ extraRepo }))
await addRepo(db, { path: repo, featureBase: 'origin/dev/tribe-2', branchPrefix: 'feat/tribe-2/' })
const accountDir = join(home, 'claude-account')
mkdirSync(accountDir)
const account = insertAccount(db, { agent: 'claude', label: 'smoke', kind: 'attached', configDir: accountDir })
db.prepare("UPDATE accounts SET login_status = 'logged_in', email = 'smoke@example.com' WHERE id = ?").run(account.id)

// Fake Claude: answers, asks to run a command, reports the decision.
const agent = fakeAdapter(async (o, emit) => {
  emit({ type: 'session.started', sessionId: 'smoke-session', model: o.model })
  emit({ type: 'message.text', text: `Working on: ${o.prompt}` })
  emit({ type: 'tool.started', toolUseId: 't1', name: 'Bash', summary: 'touch smoke.txt' })
  const answer = await o.onToolRequest({ tool: 'Bash', input: { command: 'touch smoke.txt' } })
  emit({ type: 'tool.result', toolUseId: 't1', isError: answer === 'deny', summary: answer === 'deny' ? 'denied' : 'ok' })
  emit({ type: 'message.text', text: `The command was ${answer === 'deny' ? 'denied' : 'allowed'}.` })
  emit({ type: 'turn.done', ok: true, numTurns: 2 })
})
const chats = new ChatService(db, { claude: agent })
const { app } = createRuntimeApp({ security: { token: E2E_TOKEN, allowedHosts: localHosts(E2E_PORT) }, db, chats, webRoot: WEB_ROOT })
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: E2E_PORT, websocket: { server: new WebSocketServer({ noServer: true }) } }, () =>
  console.info(`e2e server on ${E2E_PORT}`),
)
