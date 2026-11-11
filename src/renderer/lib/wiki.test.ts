import { describe, expect, it } from 'vitest'
import { wikiToMarkdown } from './wiki'

const links = {
  'Design - Fitrah': 'brainstorm/Design - Fitrah.md',
  '_sources/figma/1-2.png': 'brainstorm/_sources/figma/1-2.png',
  Missing: null,
}

describe('wikiToMarkdown', () => {
  it('turns wiki-links into in-app links (AC-D2)', () => {
    expect(wikiToMarkdown('See [[Design - Fitrah]].', links)).toBe('See [Design - Fitrah](#doc:brainstorm%2FDesign%20-%20Fitrah.md).')
    expect(wikiToMarkdown('[[Design - Fitrah|the design]]', links)).toBe('[the design](#doc:brainstorm%2FDesign%20-%20Fitrah.md)')
  })

  it('turns image embeds into images with a width (AC-D3)', () => {
    expect(wikiToMarkdown('![[_sources/figma/1-2.png|600]]', links)).toBe(
      '![_sources/figma/1-2.png](/api/docs/asset?path=brainstorm%2F_sources%2Ffigma%2F1-2.png "w=600")',
    )
  })

  it('marks missing targets and leaves code blocks alone', () => {
    expect(wikiToMarkdown('[[Missing]]', links)).toBe('*\\[\\[Missing\\]\\] (not found)*')
    const code = '```\n[[Design - Fitrah]]\n```'
    expect(wikiToMarkdown(code, links)).toBe(code)
  })
})
