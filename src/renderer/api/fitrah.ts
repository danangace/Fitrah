import { z } from 'zod/v4'
import { API } from '../../shared/api'
import { Repo, type RepoInput, Settings } from '../../shared/schemas'
import { request } from './http-client'

const Ok = z.object({ ok: z.literal(true) })

/** Typed calls to the runtime. Grows per topic. */
export const api = {
  getSettings: () => request('GET', API.settings, Settings),
  saveSettings: (settings: Settings) => request('PUT', API.settings, Settings, settings),
  listRepos: () => request('GET', API.repos, z.array(Repo)),
  addRepo: (input: RepoInput) => request('POST', API.repos, Repo, input),
  updateRepo: (id: string, input: Partial<RepoInput>) => request('PATCH', `${API.repos}/${id}`, Repo, input),
  removeRepo: (id: string) => request('DELETE', `${API.repos}/${id}`, Ok),
}
