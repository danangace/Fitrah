/** Variables that would switch Claude Code off the subscription login or leak a parent session. */
const STRIPPED = (key: string) =>
  key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_') || key === 'CLAUDECODE' || key === 'CLAUDE_CONFIG_DIR'

/**
 * Environment for any Claude Code process Fitrah starts: the account's config folder, and no
 * API-key variables, so the claude.ai subscription login is used (Spike - Login S2).
 */
export function claudeEnv(configDir: string, base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !STRIPPED(key)) env[key] = value
  }
  env.CLAUDE_CONFIG_DIR = configDir
  return env
}
