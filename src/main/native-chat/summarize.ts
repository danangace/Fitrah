/** One-line summary of a tool input for the chat UI and approval cards. */
export function summarizeTool(tool: string, input: Record<string, unknown>): string {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  switch (tool) {
    case 'Bash':
      return str('command')
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return str('file_path') || str('notebook_path')
    case 'Glob':
    case 'Grep':
      return str('pattern')
    case 'WebFetch':
      return str('url')
    case 'WebSearch':
      return str('query')
    default: {
      const json = JSON.stringify(input)
      return json.length > 160 ? `${json.slice(0, 160)}…` : json
    }
  }
}
