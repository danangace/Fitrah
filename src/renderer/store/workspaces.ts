import { create } from 'zustand'
import type { Repo, Workspace } from '../../shared/schemas'
import { api } from '../api/nakoda'

type State = {
  workspaces: Workspace[]
  repos: Repo[]
  loaded: boolean
  load: () => Promise<void>
  patch: (id: string, patch: Partial<Workspace>) => void
}

/** Workspaces + repos shared by the sidebar and pages (cross-tree state → zustand). */
export const useWorkspaces = create<State>((set) => ({
  workspaces: [],
  repos: [],
  loaded: false,
  load: async () => {
    const [workspaces, repos] = await Promise.all([api.listWorkspaces(), api.listRepos()])
    set({ workspaces, repos, loaded: true })
  },
  patch: (id, patch) => set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
}))
