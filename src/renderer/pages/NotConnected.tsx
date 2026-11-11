import { APP_INFO } from '../../shared/app-info'

/** Shown when this browser has no Fitrah session (e.g. a second browser). */
export function NotConnected() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="max-w-lg space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="text-lg font-semibold text-white">This browser isn't connected to {APP_INFO.name}</h1>
        <p className="text-sm text-neutral-400">
          Fitrah only accepts browsers that opened its private link, so other websites and apps can't control it.
        </p>
        <div className="space-y-2 text-sm text-neutral-300">
          <p>In a terminal, run one of these:</p>
          <pre className="rounded bg-neutral-950 px-3 py-2 text-xs">
            {`${APP_INFO.cli} open          # opens Fitrah in your default browser\n${APP_INFO.cli} open --print  # prints the link to paste into this browser`}
          </pre>
          <p className="text-xs text-neutral-500">Keep the link private: it gives full access to your Fitrah.</p>
        </div>
      </div>
    </main>
  )
}
