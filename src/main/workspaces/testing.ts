import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })

/** A repo with a real `origin` remote (bare) holding `main` and `dev/tribe-2`, like the monorepo. */
export function makeRepoWithOrigin(): { repo: string; origin: string } {
  const base = mkdtempSync(join(tmpdir(), 'fitrah-git-'))
  const origin = join(base, 'origin.git')
  const repo = join(base, 'repo')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['clone', '-q', origin, repo], { stdio: 'pipe' })
  run(repo, 'config', 'user.email', 't@example.com')
  run(repo, 'config', 'user.name', 'Test')
  writeFileSync(join(repo, 'README.md'), '# repo\n')
  run(repo, 'add', '.')
  run(repo, 'commit', '-q', '-m', 'init')
  run(repo, 'push', '-q', 'origin', 'HEAD:main')
  run(repo, 'push', '-q', 'origin', 'HEAD:dev/tribe-2')
  return { repo, origin }
}

export function gitOut(cwd: string, ...args: string[]): string {
  return run(cwd, ...args).toString().trim()
}
