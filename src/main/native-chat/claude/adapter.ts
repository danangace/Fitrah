import { query } from '@anthropic-ai/claude-agent-sdk'
import { claudeEnv } from '../../accounts/env'
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
            : { behavior: 'deny', message: 'The user denied this action in Fitrah.' }
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
