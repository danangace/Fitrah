import { create } from 'zustand'
import { type Route, parseRoute, routePath } from '../lib/route'

type RouterState = {
  route: Route
  navigate: (route: Route) => void
}

export const useRouter = create<RouterState>((set) => ({
  route: parseRoute(window.location.pathname),
  navigate: (route) => {
    const path = routePath(route)
    if (path !== window.location.pathname) window.history.pushState(null, '', path)
    set({ route })
  },
}))

window.addEventListener('popstate', () => useRouter.setState({ route: parseRoute(window.location.pathname) }))
