import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

/** Multi-line plain text (descriptions). */
export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={5}
      className={cn(
        'w-full resize-y rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none',
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
        'w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground/70">{hint}</span>}
    </label>
  )
}

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {actions}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-destructive/30 bg-destructive/10 text-red-200',
    ok: 'border-success/25 bg-success/10 text-success',
    info: 'border-border bg-secondary/60 text-foreground/80',
  }
  return <div className={cn('rounded-md border px-3 py-2 text-sm', tones[tone])}>{children}</div>
}
