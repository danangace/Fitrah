import { APP_INFO } from '../shared/app-info'

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-100">
      <h1 className="text-3xl font-semibold">{APP_INFO.name}</h1>
      <p className="text-neutral-400">{APP_INFO.acronym}</p>
    </main>
  )
}
