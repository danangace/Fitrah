/** "a=b" lines → map. Blank lines and lines without exactly one `=` are ignored. */
export function parseMap(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .map((l) => l.split('=').map((p) => p.trim()))
      .filter((p): p is [string, string] => p.length === 2 && Boolean(p[0]) && Boolean(p[1])),
  )
}

export const formatMap = (map: Record<string, string>): string =>
  Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
