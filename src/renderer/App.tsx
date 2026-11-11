import { Sidebar } from './components/layout/Sidebar'
import { Placeholder } from './pages/Placeholder'
import { SettingsPage } from './pages/SettingsPage'
import { useRouter } from './store/router'

function Page() {
  const route = useRouter((s) => s.route)
  switch (route.name) {
    case 'home':
      return <Placeholder title="Workspaces" text="Create a workspace to start a chat. (T15–T18)" />
    case 'docs':
      return <Placeholder title="Docs" text="Read-only docs browser. (T12–T14)" />
    case 'settings':
      return <SettingsPage section={route.section} />
    case 'workspace':
      return <Placeholder title="Workspace" text={`Workspace ${route.id}. (T17)`} />
    case 'not-found':
      return <Placeholder title="Not found" text="This page does not exist." />
  }
}

export function App() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Page />
      </main>
    </div>
  )
}
