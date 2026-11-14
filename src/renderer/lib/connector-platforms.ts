export type PlatformId = 'helix' | 'jira' | 'clickup' | 'lark'

export type Platform = {
  id: PlatformId
  name: string
  /** How this platform is connected; each one asks for different things. */
  method: string
  /** Only Helix can be connected today; the rest are listed so people know what is coming. */
  available: boolean
}

export const PLATFORMS: readonly Platform[] = [
  { id: 'helix', name: 'Helix', method: 'Read-only API token', available: true },
  { id: 'jira', name: 'Jira', method: 'Email and API token', available: false },
  { id: 'clickup', name: 'ClickUp', method: 'Personal API token', available: false },
  { id: 'lark', name: 'Lark', method: 'App ID and app secret', available: false },
]

export function platformById(id: PlatformId): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0]!
}

export type ConnectionState = 'connected' | 'failed' | 'untested' | 'unconfigured'

/** `lastCheckedAt` is only set by a successful test and cleared on every edit, so it is the "connected" signal. */
export function connectionState(input: { configured: boolean; lastCheckedAt: string | null; testError?: boolean }): ConnectionState {
  if (!input.configured) return 'unconfigured'
  if (input.testError) return 'failed'
  return input.lastCheckedAt ? 'connected' : 'untested'
}
