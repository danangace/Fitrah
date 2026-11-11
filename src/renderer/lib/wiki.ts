const IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i

export const DOC_LINK_PREFIX = '#doc:'

const assetUrl = (path: string) => `/api/docs/asset?path=${encodeURIComponent(path)}`
const docHref = (path: string) => `${DOC_LINK_PREFIX}${encodeURIComponent(path)}`
const escapeText = (text: string) => text.replace(/([[\]])/g, '\\$1')

/**
 * Turn Obsidian syntax into plain markdown before rendering:
 * `![[img.png|600]]` → image (width in the title), `[[Note|alias]]` → in-app link.
 * Fenced code blocks are left untouched.
 */
export function wikiToMarkdown(body: string, links: Record<string, string | null>): string {
  return body
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith('```') ? part : convert(part, links)))
    .join('')
}

function convert(text: string, links: Record<string, string | null>): string {
  return text.replace(/(!?)\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, bang: string, rawTarget: string, extra?: string) => {
    const target = rawTarget.trim()
    const resolved = links[target] ?? null
    const label = escapeText(extra?.trim() || target.split('/').pop()?.replace(/\.md$/, '') || target)
    if (!resolved) return `*${escapeText(`[[${target}]]`)} (not found)*`
    if (bang && IMAGE.test(resolved)) {
      const width = extra && /^\d+$/.test(extra.trim()) ? ` "w=${extra.trim()}"` : ''
      return `![${escapeText(target)}](${assetUrl(resolved)}${width})`
    }
    return `[${label}](${docHref(resolved)})`
  })
}
