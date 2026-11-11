import { Sidebar } from './components/layout/Sidebar'
import { ChatsPanel } from './components/native-chat/ChatsPanel'
import { WorkspaceList } from './components/workspace/WorkspaceList'
import { DocsPage } from './pages/DocsPage'
import { HomePage } from './pages/HomePage'
import { Placeholder } from './pages/Placeholder'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { useRouter } from './store/router'

function Page() {
  const route = useRouter((s) => s.route)
  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'docs':
      return <DocsPage path={route.path} />
    case 'settings':
      return <SettingsPage section={route.section} />
    case 'workspace':
      return <WorkspacePage id={route.id} chats={(ws) => <ChatsPanel workspace={ws} />} />
    case 'not-found':
      return <Placeholder title="Not found" text="This page does not exist." />
  }
}

export function App() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar workspaces={<WorkspaceList />} />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Page />
      </main>
    </div>
  )
}
