import { WorkspaceNotifier } from './components/layout/Attention'
import { StatusBar } from './components/layout/StatusBar'
import { Sidebar } from './components/layout/Sidebar'
import { Toaster } from './components/ui/Toaster'
import { ChatsPanel } from './components/native-chat/ChatsPanel'
import { CreateWorkspaceModal } from './components/workspace/CreateWorkspaceModal'
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
  if (modal?.kind === 'add-project') return <AddProjectModal onClose={close} />
  if (modal?.kind === 'create-workspace') return <CreateWorkspaceModal projectId={modal.projectId} onClose={close} />
  return null
}

export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
      <WorkspaceNotifier />
      <Modals />
      <Sidebar workspaces={<WorkspaceList />} />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Page />
      </main>
      </div>
      <StatusBar />
      <Toaster />
    </div>
  )
}
