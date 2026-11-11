import { z } from 'zod/v4'
import { API } from '../../shared/api'
import {
  Account,
  type AgentId,
  DetectedLogin,
  DocNode,
  Repo,
  type RepoInput,
  Settings,
  Workspace,
  type WorkspaceInput,
} from '../../shared/schemas'
import { request } from './http-client'

const Ok = z.object({ ok: z.literal(true) })

export const LoginView = z.object({
  id: z.string(),
  state: z.enum(['starting', 'waiting_for_user', 'done', 'failed', 'cancelled']),
  link: z.string().nullable(),
  codePrompt: z.boolean(),
  account: Account.nullable(),
  error: z.string().nullable(),
})
export type LoginView = z.infer<typeof LoginView>

export const DocFile = z.object({
  path: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
  links: z.record(z.string(), z.string().nullable()),
})
export type DocFile = z.infer<typeof DocFile>

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
  docsTree: () => request('GET', API.docsTree, z.array(DocNode)),
  docsFile: (path: string) => request('GET', `${API.docsFile}?path=${encodeURIComponent(path)}`, DocFile),
  listWorkspaces: () => request('GET', API.workspaces, z.array(Workspace)),
  getWorkspace: (id: string) => request('GET', `${API.workspaces}/${id}`, Workspace),
  createWorkspace: (input: WorkspaceInput) => request('POST', API.workspaces, Workspace, input),
  setupLog: (id: string) => request('GET', `${API.workspaces}/${id}/setup-log`, z.object({ log: z.string() })),
  startLogin: (label: string) => request('POST', `${API.accounts}/login`, LoginView, { label }),
  getLogin: (id: string) => request('GET', `${API.accounts}/login/${id}`, LoginView),
  submitLoginCode: (id: string, code: string) => request('POST', `${API.accounts}/login/${id}/code`, LoginView, { code }),
  cancelLogin: (id: string) => request('DELETE', `${API.accounts}/login/${id}`, LoginView),
}
