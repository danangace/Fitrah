import { homedir } from 'node:os'
import { join } from 'node:path'
import { expandHome, isDirectory } from '../../paths'

/** Folders that may hold a Claude Code login: the usual ones plus a CLAUDE_CONFIG_DIR in use. */
export function claudeLoginCandidates(home = homedir(), env: NodeJS.ProcessEnv = process.env): string[] {
  const dirs = new Set<string>()
  if (env.CLAUDE_CONFIG_DIR) dirs.add(expandHome(env.CLAUDE_CONFIG_DIR))
  dirs.add(join(home, '.claude'))
  return [...dirs].filter(isDirectory)
}

/** Also pick up sibling folders like `~/.claude-work`, `~/.claude-sid`. */
export function claudeSiblingDirs(home = homedir(), list: (dir: string) => string[]): string[] {
  return list(home)
    .filter((name) => /^\.claude-[\w-]+$/.test(name))
    .map((name) => join(home, name))
    .filter(isDirectory)
}
