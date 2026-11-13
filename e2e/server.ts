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

const home = mkdtempSync(join(tmpdir(), 'nakoda-e2e-'))
process.env.NAKODA_HOME = join(home, '.nakoda')

const vault = join(home, 'vault')
mkdirSync(join(vault, 'notes'), { recursive: true })
writeFileSync(
  join(vault, 'README.md'),
  '---\ntags: [smoke]\n---\n# Smoke vault\n\nSee [[Second note]].\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```mermaid\nflowchart LR\n  A --> B\n```\n',
)
writeFileSync(join(vault, 'notes', 'Second note.md'), '# Second note\n\nHello from the second note.\n')

const db = openDb(':memory:')
// The smoke tests exercise the approval prompt, so new chats start at "Accept edits" here (the app default is "Full access").
saveSettings(db, {
  ...DEFAULT_SETTINGS,
  docsRoot: vault,
  workspacesDir: join(home, 'workspaces'),
  chatDefaults: { effort: 'medium', permissionMode: 'accept-edits' },
})
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

const inMins = (m: number) => Math.round(Date.now() / 1000) + m * 60

// Fake Claude: answers, asks to run a command, reports the decision.
const agent = fakeAdapter(async (o, emit) => {
  emit({ type: 'session.started', sessionId: 'smoke-session', model: o.model })
  emit({
    type: 'usage',
    windows: [
      { key: 'five_hour', utilization: 0.82, resetsAt: inMins(56), status: 'allowed' },
      { key: 'seven_day', utilization: 0.46, resetsAt: inMins(3 * 1440 + 21 * 60), status: 'allowed' },
    ],
  })
  emit({ type: 'message.text', text: `Working on: ${o.prompt}` })
  // A short "thinking" pause, so the UI's working state can be seen.
  await new Promise((r) => setTimeout(r, 1200))
  emit({ type: 'tool.started', toolUseId: 't1', name: 'Bash', summary: 'touch smoke.txt' })
  const answer = await o.onToolRequest({ tool: 'Bash', input: { command: 'touch smoke.txt' } })
  emit({ type: 'tool.result', toolUseId: 't1', isError: answer === 'deny', summary: answer === 'deny' ? 'denied' : 'ok' })
  emit({ type: 'message.text', text: `The command was ${answer === 'deny' ? 'denied' : 'allowed'}.` })
  emit({ type: 'turn.done', ok: true, numTurns: 2 })
})
const chats = new ChatService(db, { claude: agent })
// The account's models as Claude Code would report them (no real Claude call in e2e).
const modelListers = {
  claude: async () => [
    { value: 'opus', displayName: 'Opus 5.5', description: 'For complex work and everyday tasks', resolvedModel: 'claude-opus-5-5', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] as const },
    { value: 'fable', displayName: 'Fable 5.2', description: 'For your toughest challenges', resolvedModel: 'claude-fable-5-2', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] as const },
    { value: 'sonnet', displayName: 'Sonnet 5.5', description: 'Most efficient for simpler tasks', resolvedModel: 'claude-sonnet-5-5', efforts: ['low', 'medium', 'high'] as const },
    { value: 'haiku', displayName: 'Haiku 5.5', description: 'Fastest for quick answers', resolvedModel: 'claude-haiku-5-5', efforts: [] },
  ].map((m) => ({ ...m, efforts: [...m.efforts] })),
}
const { app } = createRuntimeApp({ security: { token: E2E_TOKEN, allowedHosts: localHosts(E2E_PORT) }, db, chats, webRoot: WEB_ROOT, modelListers })
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: E2E_PORT, websocket: { server: new WebSocketServer({ noServer: true }) } }, () =>
  console.info(`e2e server on ${E2E_PORT}`),
)
