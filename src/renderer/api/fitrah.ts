import { z } from 'zod/v4'
import { API } from '../../shared/api'
import { Account, type AgentId, DetectedLogin, Repo, type RepoInput, Settings } from '../../shared/schemas'
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
  listAccounts: () => request('GET', API.accounts, z.array(Account)),
  detectLogins: () => request('GET', API.accountsDetect, z.array(DetectedLogin)),
  attachAccount: (agent: AgentId, configDir: string, label?: string) =>
    request('POST', API.accounts, Account, { agent, configDir, label }),
  checkAccount: (id: string) => request('POST', `${API.accounts}/${id}/check`, Account),
  setDefaultAccount: (id: string) => request('POST', `${API.accounts}/${id}/default`, Account),
  removeAccount: (id: string) => request('DELETE', `${API.accounts}/${id}`, Ok),
}
