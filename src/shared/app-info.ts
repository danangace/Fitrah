/**
 * Product identity shared by the runtime, the UI and the CLI. Nakoda (from Indonesian *nakhoda*,
 * Persian *nākhudā*, "master of the ship"): you are the captain, the agents are your crew.
 */
export const APP_INFO = {
  name: 'Nakoda',
  tagline: "You're the captain, the agents are your crew",
  cli: 'nakoda',
} as const

export function appTitle(): string {
  return `${APP_INFO.name}: ${APP_INFO.tagline}`
}
