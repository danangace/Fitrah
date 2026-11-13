import { describe, expect, it } from 'vitest'
import { tiptapToMarkdown } from './tiptap'

const p = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: 'paragraph', content: [{ type: 'text', text, marks }] })

describe('tiptapToMarkdown', () => {
  it('gives empty text for missing or non-document input', () => {
    expect(tiptapToMarkdown(null)).toBe('')
    expect(tiptapToMarkdown(undefined)).toBe('')
    expect(tiptapToMarkdown('x')).toBe('')
  })

  it('joins paragraphs with blank lines and drops empty trailing ones', () => {
    expect(tiptapToMarkdown({ type: 'doc', content: [p('one'), p('two'), { type: 'paragraph' }] })).toBe('one\n\ntwo')
  })

  it('renders marks, links, headings and code', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Title' }] },
        p('bold', [{ type: 'bold' }]),
        p('docs', [{ type: 'link', attrs: { href: 'https://x.test' } }]),
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'a = 1' }] },
      ],
    }
    expect(tiptapToMarkdown(doc)).toBe('### Title\n\n**bold**\n\n[docs](https://x.test)\n\n```ts\na = 1\n```')
  })

  it('renders bullet and ordered lists, including the start number and nesting', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('c')] }, { type: 'listItem', content: [p('d')] }] },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [p('a'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('inner')] }] }] }],
        },
      ],
    }
    expect(tiptapToMarkdown(doc)).toBe('3. c\n4. d\n\n- a\n  - inner')
  })

  it('keeps the text of unknown nodes instead of dropping it', () => {
    expect(tiptapToMarkdown({ type: 'doc', content: [{ type: 'mystery', content: [{ type: 'text', text: 'kept' }] }] })).toBe('kept')
  })
})
