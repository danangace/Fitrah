import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const DEFAULT_PORT = 4317
export const HOST = '127.0.0.1'

/** Fitrah's data folder (`~/.fitrah`). Override with FITRAH_HOME (used by tests). */
export function fitrahHome(): string {
  return process.env.FITRAH_HOME ?? join(homedir(), '.fitrah')
}

export function runtimePort(): number {
  const raw = process.env.FITRAH_PORT
  const port = raw ? Number(raw) : DEFAULT_PORT
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid FITRAH_PORT: ${raw}`)
  return port
}

/** Built browser UI (vite build output). */
export const WEB_ROOT = resolve(import.meta.dirname, '../../out/web')
