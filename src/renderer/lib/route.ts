/** App routes. Tiny path router: no router library needed for a handful of pages. */
export type Route =
  | { name: 'home' }
  | { name: 'docs'; path: string }
  | { name: 'settings'; section: string }
  | { name: 'tasks'; tab: string }
  | { name: 'workspace'; id: string }
  | { name: 'project'; id: string }
  | { name: 'not-found' }

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [head, ...rest] = parts
  if (!head) return { name: 'home' }
  if (head === 'docs') return { name: 'docs', path: rest.join('/') }
  if (head === 'settings') return { name: 'settings', section: rest[0] ?? 'general' }
  if (head === 'tasks') return { name: 'tasks', tab: rest[0] ?? 'board' }
  if (head === 'workspaces' && rest[0]) return { name: 'workspace', id: rest[0] }
  if (head === 'projects' && rest[0]) return { name: 'project', id: rest[0] }
  return { name: 'not-found' }
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/'
    case 'docs':
      return `/docs/${route.path.split('/').map(encodeURIComponent).join('/')}`.replace(/\/$/, '')
    case 'settings':
      return `/settings/${route.section}`
    case 'tasks':
      return `/tasks/${route.tab}`
    case 'workspace':
      return `/workspaces/${encodeURIComponent(route.id)}`
    case 'project':
      return `/projects/${encodeURIComponent(route.id)}`
    case 'not-found':
      return '/'
  }
}
