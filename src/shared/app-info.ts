/** Product identity shared by the runtime, the UI and the CLI. */
export const APP_INFO = {
  name: 'Fitrah',
  acronym: 'Finance Iteration Tools, Review & Agent Hub',
  cli: 'fitrah',
} as const

export function appTitle(): string {
  return `${APP_INFO.name}: ${APP_INFO.acronym}`
}
