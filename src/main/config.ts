import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const DEFAULT_PORT = 4317
export const HOST = '127.0.0.1'

/** Read a setting from the environment: NAKODA_* first, then the old FITRAH_* name (before the rename). */
export function envSetting(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`NAKODA_${name}`] ?? env[`FITRAH_${name}`]
}

/**
 * Nakoda's data folder: `~/.nakoda`, or the existing `~/.fitrah` from before the rename, which is
 * used in place (never moved: accounts and chats store absolute paths inside it). NAKODA_HOME (or
 * the old FITRAH_HOME) overrides it, e.g. in tests.
 */
export function nakodaHome(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const override = envSetting('HOME', env)
  if (override) return override
  const current = join(home, '.nakoda')
  const legacy = join(home, '.fitrah')
  return !existsSync(current) && existsSync(legacy) ? legacy : current
}

/** The database file in the data folder; an existing `fitrah.db` from before the rename is kept. */
export function databaseFile(dir = nakodaHome()): string {
  const legacy = join(dir, 'fitrah.db')
  const current = join(dir, 'nakoda.db')
  return !existsSync(current) && existsSync(legacy) ? legacy : current
}

export function runtimePort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = envSetting('PORT', env)
  const port = raw ? Number(raw) : DEFAULT_PORT
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid NAKODA_PORT: ${raw}`)
  return port
}

/** Built browser UI (vite build output). */
export const WEB_ROOT = resolve(import.meta.dirname, '../../out/web')
