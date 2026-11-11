import type { LoginStatus } from '../../../shared/schemas'
import { execFileAsync } from '../../paths'
import { claudeEnv } from '../env'

export type StatusResult = {
  loginStatus: LoginStatus
  email: string | null
  loginExpiresAt: string | null
  warning: string | null
}

export type Runner = (
  file: string,
  args: string[],
  options: { env: Record<string, string>; timeout: number },
) => Promise<{ stdout: string }>

/** `claude auth status --json` for one config folder (verified in Spike - Login S1). */
export async function claudeStatus(configDir: string, run: Runner = execFileAsync): Promise<StatusResult> {
  let stdout: string
  try {
    ;({ stdout } = await run('claude', ['auth', 'status', '--json'], { env: claudeEnv(configDir), timeout: 15_000 }))
  } catch (error) {
    const out = (error as { stdout?: string }).stdout
    if (!out) {
      return { loginStatus: 'error', email: null, loginExpiresAt: null, warning: 'Could not run `claude auth status`. Is Claude Code installed?' }
    }
    stdout = out
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(stdout) as Record<string, unknown>
  } catch {
    return { loginStatus: 'error', email: null, loginExpiresAt: null, warning: 'Unexpected output from `claude auth status`' }
  }
  const loggedIn = data.loggedIn === true
  const authMethod = typeof data.authMethod === 'string' ? data.authMethod : null
  const warning =
    loggedIn && authMethod !== 'claude.ai'
      ? `Logged in with "${authMethod ?? 'unknown'}", not a claude.ai subscription; usage may be billed.`
      : null
  return {
    loginStatus: loggedIn ? 'logged_in' : 'logged_out',
    email: typeof data.email === 'string' ? data.email : null,
    loginExpiresAt: typeof data.loginExpiresAt === 'string' ? data.loginExpiresAt : null,
    warning,
  }
}
