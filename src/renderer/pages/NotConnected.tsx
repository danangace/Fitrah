import { APP_INFO } from '../../shared/app-info'

/** Shown when this browser has no Nakoda session (e.g. a second browser). */
export function NotConnected() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">This browser isn't connected to {APP_INFO.name}</h1>
        <p className="text-sm text-muted-foreground">
          Nakoda only accepts browsers that opened its private link, so other websites and apps can't control it.
        </p>
        <div className="space-y-2 text-sm text-foreground/80">
          <p>In a terminal, run one of these:</p>
          <pre className="rounded bg-background px-3 py-2 text-xs">
            {`${APP_INFO.cli} open          # opens Nakoda in your default browser\n${APP_INFO.cli} open --print  # prints the link to paste into this browser`}
          </pre>
          <p className="text-xs text-muted-foreground">Keep the link private: it gives full access to your Nakoda.</p>
        </div>
      </div>
    </main>
  )
}
