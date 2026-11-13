import { query } from '@anthropic-ai/claude-agent-sdk'
import { tmpdir } from 'node:os'
import { claudeEnv } from '../../accounts/env'

/**
 * Runs `fn` with a Claude Code session for one login that never sends a message, so nothing is
 * billed. The session is closed as soon as `fn` finishes.
 */
export async function withIdleSession<T>(configDir: string, fn: (session: ReturnType<typeof query>) => Promise<T>): Promise<T> {
  let release: (() => void) | undefined
  const idle = new Promise<void>((resolve) => {
    release = resolve
  })
  // A prompt stream that ends (without a message) only when we are done.
  const noMessages: AsyncIterable<never> = {
    [Symbol.asyncIterator]: () => ({ next: () => idle.then(() => ({ done: true as const, value: undefined as never })) }),
  }
  const session = query({ prompt: noMessages, options: { cwd: tmpdir(), env: claudeEnv(configDir) } })
  try {
    return await fn(session)
  } finally {
    release?.()
    session.close()
  }
}
