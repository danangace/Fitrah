import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

export const TOKEN_HEADER = 'x-nakoda-token'
export const TOKEN_COOKIE = 'nakoda_token'

export type SecurityConfig = {
  token: string
  /** Host header values accepted, e.g. `127.0.0.1:4317`. */
  allowedHosts: string[]
}

/** Read the session token from `<home>/token`, creating it (mode 600) on first run. */
export function loadOrCreateToken(home: string): string {
  const file = join(home, 'token')
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim()
    if (existing.length >= 32) return existing
  }
  mkdirSync(home, { recursive: true, mode: 0o700 })
  const token = randomBytes(32).toString('hex')
  writeFileSync(file, `${token}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
  return token
}

/** Hosts for the runtime port, plus the Vite dev server port when given. */
export function localHosts(port: number, devPort?: number): string[] {
  const ports = devPort ? [port, devPort] : [port]
  return ports.flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`])
}

export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (!given) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Blocks DNS-rebinding and cross-site calls: the Host must be a local host:port, and a
 * browser Origin (when sent) must be one of those hosts.
 */
export function hostGuard(config: SecurityConfig): MiddlewareHandler {
  const origins = new Set(config.allowedHosts.map((h) => `http://${h}`))
  const hosts = new Set(config.allowedHosts)
  return async (c, next) => {
    const host = c.req.header('host')
    if (!host || !hosts.has(host)) return c.json({ error: 'forbidden_host' }, 403)
    const origin = c.req.header('origin')
    if (origin && !origins.has(origin)) return c.json({ error: 'forbidden_origin' }, 403)
    await next()
  }
}

/** Requires the session token in the header or the session cookie. */
export function tokenGuard(config: SecurityConfig): MiddlewareHandler {
  return async (c, next) => {
    const given = c.req.header(TOKEN_HEADER) ?? getCookie(c, TOKEN_COOKIE)
    if (!tokenMatches(config.token, given)) return c.json({ error: 'unauthorized' }, 401)
    await next()
  }
}
