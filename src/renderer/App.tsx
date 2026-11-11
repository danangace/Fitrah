import { WorkspaceNotifier } from './components/layout/Attention'
import { Sidebar } from './components/layout/Sidebar'
import { ChatsPanel } from './components/native-chat/ChatsPanel'
import { WorkspaceList } from './components/workspace/WorkspaceList'
import { AddProjectModal } from './components/projects/AddProjectModal'
import { DocsPage } from './pages/DocsPage'
import { HomePage } from './pages/HomePage'
import { Placeholder } from './pages/Placeholder'
import { ProjectPage } from './pages/ProjectPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { useRouter } from './store/router'
import { useModal } from './store/ui'

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
    case 'project':
      return <ProjectPage id={route.id} />
    case 'not-found':
      return <Placeholder title="Not found" text="This page does not exist." />
  }
}

function Modals() {
  const { modal, close } = useModal()
  const navigate = useRouter((s) => s.navigate)
  if (modal?.kind === 'add-project') return <AddProjectModal onClose={close} />
  if (modal?.kind === 'create-workspace') {
    // Until the Create workspace modal lands (phase D): the old form on the home page.
    close()
    navigate({ name: 'home' })
  }
  return null
}

export function App() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <WorkspaceNotifier />
      <Modals />
      <Sidebar workspaces={<WorkspaceList />} />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Page />
      </main>
    </div>
  )
}
