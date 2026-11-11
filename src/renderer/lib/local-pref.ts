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
