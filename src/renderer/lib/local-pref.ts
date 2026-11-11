/** Per-browser UI preference (e.g. panel open); never required for the app to work. */
export function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(`fitrah:${key}`)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(`fitrah:${key}`, value ? '1' : '0')
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

export function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(window.localStorage.getItem(`fitrah:${key}`))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function writeNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(`fitrah:${key}`, String(Math.round(value)))
  } catch {
    /* storage blocked */
  }
}
