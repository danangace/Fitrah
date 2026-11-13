/** Helix rich text is a Tiptap document; Nakoda keeps markdown. Unknown nodes fall back to their text. */
export type TiptapNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: TiptapNode[]
}

function applyMarks(text: string, marks: TiptapNode['marks']): string {
  let out = text
  for (const mark of marks ?? []) {
    if (mark.type === 'code') out = `\`${out}\``
    else if (mark.type === 'bold') out = `**${out}**`
    else if (mark.type === 'italic') out = `*${out}*`
    else if (mark.type === 'strike') out = `~~${out}~~`
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') out = `[${out}](${mark.attrs.href})`
  }
  return out
}

function inline(nodes: TiptapNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n'
      if (n.type === 'image') return typeof n.attrs?.src === 'string' ? `![${String(n.attrs.alt ?? '')}](${n.attrs.src})` : ''
      if (n.text !== undefined) return applyMarks(n.text, n.marks)
      return inline(n.content)
    })
    .join('')
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 || line === '' ? line : pad + line))
    .join('\n')
}

function list(node: TiptapNode, ordered: boolean): string {
  const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1
  return (node.content ?? [])
    .map((item, i) => {
      const marker = ordered ? `${start + i}. ` : '- '
      const body = block(item).trim()
      return marker + indent(body, ' '.repeat(marker.length))
    })
    .join('\n')
}

function block(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return blocks(node.content)
    case 'paragraph':
      return inline(node.content)
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? Math.min(Math.max(node.attrs.level, 1), 6) : 2
      return `${'#'.repeat(level)} ${inline(node.content)}`
    }
    case 'bulletList':
      return list(node, false)
    case 'orderedList':
      return list(node, true)
    case 'listItem':
      // Tight: a nested list sits right under its item's text.
      return (node.content ?? []).map(block).filter(Boolean).join('\n')
    case 'blockquote':
      return blocks(node.content)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      return `\`\`\`${lang}\n${inline(node.content)}\n\`\`\``
    }
    case 'horizontalRule':
      return '---'
    case 'image':
      return inline([node])
    default:
      // Unknown node: keep whatever text it holds so nothing silently disappears.
      return node.content ? (node.content.some((c) => c.content || c.type === 'paragraph') ? blocks(node.content) : inline(node.content)) : (node.text ?? '')
  }
}

function blocks(nodes: TiptapNode[] | undefined): string {
  return (nodes ?? [])
    .map(block)
    .filter((s, i, all) => s !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n\n')
    .trim()
}

/** Tiptap document (or null/absent) → markdown. Anything that is not a document gives ''. */
export function tiptapToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  return block(doc as TiptapNode).trim()
}
