import { useEffect, useId, useState } from 'react'

let ready: Promise<typeof import('mermaid').default> | null = null
const loadMermaid = () => {
  ready ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' })
    return mermaid
  })
  return ready
}

export function Mermaid({ code }: { code: string }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then((r) => alive && setSvg(r.svg), (e: unknown) => alive && setError(String(e)))
    return () => {
      alive = false
    }
  }, [code, id])
  if (error) return <pre className="text-xs text-red-400">Mermaid error: {error}</pre>
  if (!svg) return <div className="text-xs text-neutral-500">Rendering diagram…</div>
  // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output with securityLevel strict
  return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}
