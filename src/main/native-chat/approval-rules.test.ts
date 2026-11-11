import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { approvalRule, isInside } from './approval-rules'

const wt = '/ws/repo/kelola-xyz'
const rule = (tool: string, input: Record<string, unknown>) => approvalRule({ tool, input }, wt)

describe('approvalRule', () => {
  it('allows edits inside the worktree (AC-C3)', () => {
    expect(rule('Edit', { file_path: `${wt}/src/a.ts` })).toEqual({ action: 'allow' })
    expect(rule('Write', { file_path: 'src/new.ts' })).toEqual({ action: 'allow' })
  })

  it('asks for commands (AC-C4)', () => {
    expect(rule('Bash', { command: 'touch x' })).toMatchObject({ action: 'ask', forced: false })
    expect(rule('Bash', { command: 'pnpm install' })).toMatchObject({ action: 'ask' })
  })

  it('always asks for git push and rm -rf (AC-C5)', () => {
    for (const command of ['git push', 'git push -u origin feat/x', 'cd a && git push --force', 'rm -rf node_modules', 'rm -fr dist', 'rm -Rf x', 'rm -r -f x', 'rm --recursive --force x', 'ls && /bin/rm -rf y']) {
      expect(rule('Bash', { command })).toMatchObject({ action: 'ask', forced: true })
    }
    expect(rule('Bash', { command: 'git status' })).toMatchObject({ forced: false })
    expect(rule('Bash', { command: 'rm file.txt' })).toMatchObject({ forced: false })
    expect(rule('Bash', { command: 'rm -r dir' })).toMatchObject({ forced: false })
  })

  it('asks for paths outside the worktree (AC-C6)', () => {
    expect(rule('Edit', { file_path: '/etc/hosts' })).toMatchObject({ action: 'ask' })
    expect(rule('Write', { file_path: `${wt}/../other/a.ts` })).toMatchObject({ action: 'ask' })
  })

  it('lets read-only tools through and asks for unknown tools', () => {
    expect(rule('Read', { file_path: '/anything' })).toEqual({ action: 'allow' })
    expect(rule('Grep', { pattern: 'x' })).toEqual({ action: 'allow' })
    expect(rule('mcp__gitlab__create_merge_request', {})).toMatchObject({ action: 'ask' })
  })

  it('treats a symlinked path to the worktree as inside (macOS /var → /private/var)', () => {
    const real = mkdtempSync(join(tmpdir(), 'fitrah-real-'))
    mkdirSync(join(real, 'wt'))
    const link = join(mkdtempSync(join(tmpdir(), 'fitrah-link-')), 'l')
    symlinkSync(real, link)
    expect(isInside(join(link, 'wt'), join(real, 'wt', 'README.md'))).toBe(true)
    expect(isInside(join(real, 'wt'), join(link, 'wt', 'new', 'file.ts'))).toBe(true)
  })

  it('permission modes: ask asks for edits too, full access allows all but git push / rm -rf', () => {
    expect(approvalRule({ tool: 'Edit', input: { file_path: `${wt}/a.ts` } }, wt, 'ask')).toMatchObject({ action: 'ask', reason: 'Edits a file' })
    expect(approvalRule({ tool: 'Read', input: { file_path: '/x' } }, wt, 'ask')).toEqual({ action: 'allow' })
    expect(approvalRule({ tool: 'Bash', input: { command: 'pnpm install' } }, wt, 'full')).toEqual({ action: 'allow' })
    expect(approvalRule({ tool: 'Edit', input: { file_path: '/etc/hosts' } }, wt, 'full')).toEqual({ action: 'allow' })
    expect(approvalRule({ tool: 'Bash', input: { command: 'git push' } }, wt, 'full')).toMatchObject({ action: 'ask', forced: true })
    expect(approvalRule({ tool: 'Bash', input: { command: 'rm -rf dist' } }, wt, 'full')).toMatchObject({ action: 'ask', forced: true })
  })

  it('checks containment by path segments', () => {
    expect(isInside('/ws/a', '/ws/a/b')).toBe(true)
    expect(isInside('/ws/a', '/ws/ab/c')).toBe(false)
  })
})
