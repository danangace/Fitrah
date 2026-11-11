import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DOC_LINK_PREFIX } from '../../lib/wiki'
import { Mermaid } from './Mermaid'

/** Read-only markdown view (D-5). Doc links call `onOpenDoc` instead of navigating away. */
export function Markdown({ source, onOpenDoc }: { source: string; onOpenDoc: (path: string) => void }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith(DOC_LINK_PREFIX)) {
              const path = decodeURIComponent(href.slice(DOC_LINK_PREFIX.length))
              return (
                <a
                  href={`/docs/${path}`}
                  onClick={(e) => {
                    e.preventDefault()
                    onOpenDoc(path)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          },
          img: ({ src, alt, title }) => {
            const width = title?.startsWith('w=') ? Number(title.slice(2)) : undefined
            return <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} style={width ? { width } : undefined} />
          },
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            const text = String(children).replace(/\n$/, '')
            if (lang === 'mermaid') return <Mermaid code={text} />
            return <code className={className}>{children}</code>
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
