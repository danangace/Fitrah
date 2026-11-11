import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { OpenIn } from '../../shared/schemas'

export type ChromeProfile = { dir: string; name: string }

/** Chrome profiles on this Mac (folder + display name), from Chrome's `Local State`. */
export function listChromeProfiles(home = homedir()): ChromeProfile[] {
  const file = join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Local State')
  if (!existsSync(file)) return []
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { profile?: { info_cache?: Record<string, { name?: string }> } }
    return Object.entries(data.profile?.info_cache ?? {}).map(([dir, info]) => ({ dir, name: info.name ?? dir }))
  } catch {
    return []
  }
}

/** The command that opens `url` where the user chose (a Chrome profile, or the default browser). */
export function openCommand(url: string, openIn: OpenIn, platform = process.platform): [string, string[]] {
  if (platform === 'darwin' && openIn.kind === 'chrome') {
    // -n: pass --args to the running Chrome too; it then opens the URL in that profile.
    return ['open', ['-na', 'Google Chrome', '--args', `--profile-directory=${openIn.profile}`, url]]
  }
  if (platform === 'darwin') return ['open', [url]]
  if (platform === 'win32') return ['cmd', ['/c', 'start', '', url]]
  return ['xdg-open', [url]]
}

export function openUrl(url: string, openIn: OpenIn): void {
  const [cmd, args] = openCommand(url, openIn)
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}
