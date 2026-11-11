/** Friendly names for the model ids / aliases in Settings → Models (unknown ids are shown as-is). */
const KNOWN: { match: RegExp; name: string; description: string }[] = [
  { match: /opus/i, name: 'Claude Opus', description: 'For complex work and everyday tasks' },
  { match: /sonnet/i, name: 'Claude Sonnet', description: 'Most efficient for simpler tasks' },
  { match: /haiku/i, name: 'Claude Haiku', description: 'Fastest for quick answers' },
  { match: /fable/i, name: 'Claude Fable', description: 'For your toughest challenges' },
]

export function modelInfo(id: string): { name: string; description: string } {
  const known = KNOWN.find((k) => k.match.test(id))
  if (!known) return { name: id, description: '' }
  // Keep a version from a full id, e.g. claude-opus-5-5 → "Claude Opus 5.5".
  const version = id.match(/(\d+)[-.](\d+)/)
  return { name: version ? `${known.name} ${version[1]}.${version[2]}` : known.name, description: known.description }
}

export const EFFORTS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'XHigh' },
  { id: 'max', label: 'Max' },
] as const

export const PERMISSIONS = [
  { id: 'ask', label: 'Ask for approval', description: 'Asks before edits and commands' },
  { id: 'accept-edits', label: 'Accept edits', description: 'Edits inside the workspace run on their own; asks for commands' },
  { id: 'full', label: 'Full access', description: 'Never asks, except git push and rm -rf' },
] as const
