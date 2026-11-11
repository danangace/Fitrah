/** Product identity shared by the runtime, the UI and the CLI. */

/** Fitrah = Finance ITeration, Review and Agents Hub: [letters that spell the name, rest of the word]. */
export const ACRONYM_PARTS = [
  ['F', 'inance '],
  ['IT', 'eration, '],
  ['R', 'eview and '],
  ['A', 'gents '],
  ['H', 'ub'],
] as const

export const APP_INFO = {
  name: 'Fitrah',
  acronym: ACRONYM_PARTS.map(([letters, rest]) => letters + rest).join(''),
  cli: 'fitrah',
} as const

export function appTitle(): string {
  return `${APP_INFO.name}: ${APP_INFO.acronym}`
}
