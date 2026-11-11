import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Variables that would switch Claude Code off the subscription login or leak a parent session. */
const STRIPPED = (key: string) =>
  key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_') || key === 'CLAUDECODE' || key === 'CLAUDE_CONFIG_DIR'

/**
 * `~/.claude` is Claude Code's default folder. Its login lives in the Keychain entry
 * "Claude Code-credentials"; setting CLAUDE_CONFIG_DIR, even to `~/.claude` itself, makes Claude
 * look in a different, hashed entry and report "logged out" (found 2026-11-11). So the default
 * account must run without CLAUDE_CONFIG_DIR.
 */
export function isDefaultClaudeDir(configDir: string, home = homedir()): boolean {
  return resolve(configDir) === join(home, '.claude')
}

/**
 * Environment for any Claude Code process Fitrah starts: the account's config folder (unset for
 * the default `~/.claude`), and no API-key variables, so the claude.ai subscription login is used.
 */
export function claudeEnv(configDir: string, base: NodeJS.ProcessEnv = process.env, home = homedir()): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !STRIPPED(key)) env[key] = value
  }
  if (!isDefaultClaudeDir(configDir, home)) env.CLAUDE_CONFIG_DIR = configDir
  return env
}
