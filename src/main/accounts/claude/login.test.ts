import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDb } from '../../sqlite/db'
import { listAccounts } from '../service'
import { ClaudeLoginManager, type SpawnLogin } from './login'

/** A fake `claude auth login`: prints a link, asks for a code, exits 0 on "good" else 1. */
const FAKE = `
process.stdout.write('Opening browser to sign in…\\nIf the browser didn\\'t open, visit: https://claude.com/cai/oauth/authorize?code=true&x=1\\nPaste code here if prompted > ')
process.stdin.on('data', (d) => process.exit(String(d).trim() === 'good' ? 0 : 1))
`
const fakeSpawn: SpawnLogin = () => spawn(process.execPath, ['-e', FAKE], { stdio: ['pipe', 'pipe', 'pipe'] })
const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 20))
}

beforeEach(() => vi.stubEnv('NAKODA_HOME', mkdtempSync(join(tmpdir(), 'nakoda-home-'))))
afterEach(() => vi.unstubAllEnvs())

describe('ClaudeLoginManager', () => {
  it('shows the link, takes a pasted code and attaches a managed account (AC-A3)', async () => {
    const db = openDb(':memory:')
    const refresh = vi.fn(async (_db, id: string) => ({ ...listAccounts(db).find((a) => a.id === id)!, loginStatus: 'logged_in' as const }))
    const manager = new ClaudeLoginManager(db, fakeSpawn, refresh)
    const { id } = manager.start('Office')
    await waitFor(() => manager.view(id).state === 'waiting_for_user' && manager.view(id).codePrompt)
    expect(manager.view(id).link).toBe('https://claude.com/cai/oauth/authorize?code=true&x=1')
    manager.submitCode(id, 'good')
    await waitFor(() => manager.view(id).state === 'done')
    expect(manager.view(id).account).toMatchObject({ label: 'Office', kind: 'managed', loginStatus: 'logged_in' })
    expect(listAccounts(db)).toHaveLength(1)
  })

  it('fails on a wrong code and removes the half-made folder', async () => {
    const db = openDb(':memory:')
    let dir = ''
    const spawnSpy: SpawnLogin = (configDir) => ((dir = configDir), fakeSpawn(configDir))
    const manager = new ClaudeLoginManager(db, spawnSpy)
    const { id } = manager.start('x')
    await waitFor(() => manager.view(id).state === 'waiting_for_user')
    manager.submitCode(id, 'bad')
    await waitFor(() => manager.view(id).state === 'failed')
    expect(existsSync(dir)).toBe(false)
    expect(listAccounts(db)).toEqual([])
  })

  it('can be cancelled', async () => {
    const manager = new ClaudeLoginManager(openDb(':memory:'), fakeSpawn)
    const { id } = manager.start('x')
    expect(manager.cancel(id).state).toBe('cancelled')
  })
})
