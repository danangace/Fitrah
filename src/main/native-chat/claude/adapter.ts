import { query } from '@anthropic-ai/claude-agent-sdk'
import { claudeEnv } from '../../accounts/env'
import { tmpdir } from 'node:os'
import type { ModelOption } from '../../../shared/schemas'
import type { AgentAdapter, Turn, TurnOptions } from '../types'
import { readClaudeHistory } from './history'
import { type SdkLike, mapClaudeMessage } from './map'

/**
 * Claude via the Agent SDK, exactly as proven in Spike - Login: the account's CLAUDE_CONFIG_DIR,
 * API-key variables stripped (subscription login), explicit permission mode, every permission
 * request routed through `onToolRequest`. This is the only file that imports the SDK.
 */
export const claudeAdapter: AgentAdapter = {
  agent: 'claude',
  readHistory: readClaudeHistory,
  listModels: listClaudeModels,
  startTurn(options: TurnOptions): Turn {
    const abortController = new AbortController()
    const run = query({
      prompt: options.prompt,
      options: {
        cwd: options.cwd,
        env: claudeEnv(options.configDir),
        model: options.model,
        effort: options.effort ?? undefined,
        resume: options.sessionId ?? undefined,
        // Claude Code's own system prompt + the workspace facts on every turn.
        systemPrompt: { type: 'preset', preset: 'claude_code', append: options.context },
        // Explicit: otherwise the user's own settings (e.g. acceptEdits) would apply.
        permissionMode: 'default',
        abortController,
        canUseTool: async (tool, input) => {
          const answer = await options.onToolRequest({ tool, input })
          return answer === 'allow'
            ? { behavior: 'allow', updatedInput: input }
            : { behavior: 'deny', message: 'The user denied this action in Nakoda.' }
        },
      },
    })

    const done = (async () => {
      try {
        for await (const message of run) {
          for (const event of mapClaudeMessage(message as unknown as SdkLike)) options.onEvent(event)
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          options.onEvent({ type: 'turn.done', ok: false, numTurns: 0 })
          return
        }
        const text = (error as Error).message
        options.onEvent({ type: 'error', kind: /logged in|login|auth/i.test(text) ? 'auth' : 'other', message: text })
        options.onEvent({ type: 'turn.done', ok: false, numTurns: 0 })
      }
    })()

    return { stop: () => abortController.abort(), done }
  },
}

/**
 * The models a login may use, straight from Claude Code (`supportedModels()`). The session is
 * started with a prompt stream that never sends a message, so nothing is billed; it is closed as
 * soon as the list arrives (about 4 s).
 */
export async function listClaudeModels(configDir: string): Promise<ModelOption[]> {
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
    const models = await session.supportedModels()
    return models.map((m) => ({
      value: m.value,
      displayName: m.displayName,
      description: m.description ?? '',
      resolvedModel: m.resolvedModel ?? null,
      efforts: m.supportedEffortLevels ?? [],
    }))
  } finally {
    release?.()
    session.close()
  }
}
