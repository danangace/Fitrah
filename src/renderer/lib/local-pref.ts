/** Saved value under `nakoda:<key>`, else the old `fitrah:<key>` from before the rename. */
function stored(key: string): string | null {
  return window.localStorage.getItem(`nakoda:${key}`) ?? window.localStorage.getItem(`fitrah:${key}`)
}

/** Per-browser UI preference (e.g. panel open); never required for the app to work. */
export function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = stored(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(`nakoda:${key}`, value ? '1' : '0')
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

export function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(stored(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function writeNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(`nakoda:${key}`, String(Math.round(value)))
  } catch {
    /* storage blocked */
  }
}
