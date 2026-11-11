import { Copy, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type LoginView, api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Field, Input, Notice } from '../ui/Field'

const ACTIVE = new Set(['starting', 'waiting_for_user'])

/** Sign in a new Claude account (claude.ai subscription) without leaving Fitrah. */
export function ClaudeSignIn({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState('')
  const [code, setCode] = useState('')
  const [login, setLogin] = useState<LoginView | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Poll the sign-in session while it runs.
  useEffect(() => {
    if (!login || !ACTIVE.has(login.state)) return
    const timer = setInterval(() => {
      api.getLogin(login.id).then((next) => {
        setLogin(next)
        if (next.state === 'done') onDone()
      }, (e: unknown) => setError(errorText(e)))
    }, 1000)
    return () => clearInterval(timer)
  }, [login, onDone])

  const start = () => {
    setError(null)
    api.startLogin(label.trim()).then(setLogin, (e: unknown) => setError(errorText(e)))
  }
  const sendCode = () => {
    if (!login) return
    api.submitLoginCode(login.id, code).then(setLogin, (e: unknown) => setError(errorText(e)))
    setCode('')
  }
  const reset = () => {
    if (login && ACTIVE.has(login.state)) void api.cancelLogin(login.id)
    setLogin(null)
    setLabel('')
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-neutral-700 p-3">
      <div className="text-sm font-semibold text-neutral-200">Sign in a new Claude account</div>
      {error && <Notice tone="error">{error}</Notice>}
      {!login && (
        <div className="flex items-end gap-2">
          <Field label="Label">
            <Input value={label} placeholder="e.g. Personal" onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={!label.trim()} onClick={start}>
            Sign in
          </Button>
        </div>
      )}
      {login?.state === 'starting' && <Notice tone="info">Starting Claude sign-in…</Notice>}
      {login?.state === 'waiting_for_user' && (
        <div className="space-y-3">
          <Notice tone="info">
            A browser tab should open. If not, open the link below, sign in with your Claude subscription, and paste the code
            if the page shows one.
          </Notice>
          {login.link && (
            <div className="flex gap-2">
              <Button onClick={() => window.open(login.link ?? '', '_blank', 'noopener')}>
                <ExternalLink size={14} /> Open sign-in page
              </Button>
              <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(login.link ?? '')}>
                <Copy size={14} /> Copy link
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Field label="Code from the sign-in page">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button disabled={!code.trim()} onClick={sendCode}>
              Send code
            </Button>
          </div>
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      )}
      {login?.state === 'done' && (
        <div className="space-y-2">
          <Notice tone="ok">Signed in{login.account?.email ? ` as ${login.account.email}` : ''}.</Notice>
          <Button onClick={reset}>Sign in another account</Button>
        </div>
      )}
      {(login?.state === 'failed' || login?.state === 'cancelled') && (
        <div className="space-y-2">
          <Notice tone="error">{login.error ?? 'Sign-in cancelled.'}</Notice>
          <Button onClick={reset}>Try again</Button>
        </div>
      )}
    </div>
  )
}
