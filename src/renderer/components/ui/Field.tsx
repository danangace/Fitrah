import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

/** Multi-line, monospace: for shell scripts. */
export function ScriptArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={4}
      spellCheck={false}
      className={cn(
        'w-full resize-y rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-200">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {actions}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-red-900 bg-red-950/50 text-red-200',
    ok: 'border-emerald-900 bg-emerald-950/50 text-emerald-200',
    info: 'border-neutral-800 bg-neutral-900 text-neutral-300',
  }
  return <div className={cn('rounded-md border px-3 py-2 text-sm', tones[tone])}>{children}</div>
}
