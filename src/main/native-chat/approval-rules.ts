import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { PermissionMode } from '../../shared/schemas'
import type { ToolRequest } from './types'

export type RuleResult = { action: 'allow' } | { action: 'ask'; reason: string; forced: boolean }

/** Tools that only read or plan (OQ-22: "read anything → auto"). */
const AUTO = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'WebFetch', 'WebSearch', 'TodoWrite', 'Skill', 'Task', 'Agent', 'ExitPlanMode'])
const EDIT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/** `rm` with both recursive and force, in any flag spelling (-rf, -fr, -Rf, -r -f, --recursive --force). */
export function isRecursiveForceRm(command: string): boolean {
  return command.split(/[;&|]+/).some((segment) => {
    const tokens = segment.trim().split(/\s+/)
    const at = tokens.findIndex((t) => t === 'rm' || t.endsWith('/rm'))
    if (at === -1) return false
    const flags = tokens.slice(at + 1).filter((t) => t.startsWith('-'))
    const short = flags.filter((f) => !f.startsWith('--')).join('')
    const recursive = /[rR]/.test(short) || flags.includes('--recursive')
    const force = /f/.test(short) || flags.includes('--force')
    return recursive && force
  })
}

/** Commands that always need a click, whatever any future auto-allow says (AC-C5). */
const alwaysAsk = (command: string) => /\bgit\s+push\b/.test(command) || isRecursiveForceRm(command)

/** Real path of `path`, following symlinks of its nearest existing parent (e.g. /var → /private/var). */
export function realish(path: string): string {
  let current = path
  const rest: string[] = []
  while (!existsSync(current) && dirname(current) !== current) {
    rest.unshift(basename(current))
    current = dirname(current)
  }
  try {
    return join(realpathSync(current), ...rest)
  } catch {
    return path
  }
}

export function isInside(worktree: string, path: string): boolean {
  const root = realish(worktree)
  const rel = relative(root, realish(resolve(worktree, path)))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Fitrah's approval rules (OQ-22). Claude Code itself already lets read-only commands such as
 * `ls` through without asking (Spike - Login S4); everything that reaches here is checked.
 */
export function approvalRule(request: ToolRequest, worktree: string, mode: PermissionMode = 'accept-edits'): RuleResult {
  const { tool, input } = request
  if (tool === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    // git push / rm -rf always ask, in every mode (Danang's rule, AC-C5).
    if (alwaysAsk(command)) return { action: 'ask', reason: 'Always asks: git push / rm -rf', forced: true }
    if (mode === 'full') return { action: 'allow' }
    return { action: 'ask', reason: 'Runs a command', forced: false }
  }
  if (AUTO.has(tool)) return { action: 'allow' }
  if (mode === 'full') return { action: 'allow' }
  if (EDIT.has(tool)) {
    const path = String(input.file_path ?? input.notebook_path ?? '')
    const inside = Boolean(path) && isInside(worktree, path)
    if (inside && mode === 'accept-edits') return { action: 'allow' }
    return { action: 'ask', reason: inside ? 'Edits a file' : 'Edits a file outside the workspace', forced: false }
  }
  return { action: 'ask', reason: `Uses ${tool}`, forced: false }
}
