import { z } from 'zod/v4'

/** Agents Fitrah can drive. V1 ships Claude only; 'codex' is reserved (Design §7.3). */
export const AgentId = z.enum(['claude', 'codex'])
export type AgentId = z.infer<typeof AgentId>

const isoDate = z.string()
const nullableText = z.string().nullable()

export const AgentModels = z.object({
  list: z.array(z.string().min(1)).min(1),
  default: z.string().min(1),
})
export type AgentModels = z.infer<typeof AgentModels>

/** Where `fitrah start` / `fitrah open` open the UI. */
export const OpenIn = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('chrome'), profile: z.string().min(1) }),
])
export type OpenIn = z.infer<typeof OpenIn>

export const Settings = z.object({
  /** Markdown folder browsed read-only (e.g. the Obsidian vault). */
  docsRoot: nullableText,
  paths: z.object({
    moduleDocs: z.string(),
    plans: z.string(),
    oqFile: z.string(),
  }),
  workspacesDir: z.string().min(1),
  /** Branch name prefixes, e.g. `feat/tribe-2/` → `feat/tribe-2/<workspace-name>`. */
  branchPrefix: z.object({ feature: z.string(), defect: z.string() }).default({ feature: 'feat/', defect: 'fix/' }),
  models: z.object({ claude: AgentModels }).catchall(AgentModels),
  openIn: OpenIn.default({ kind: 'default' }),
})
export type Settings = z.infer<typeof Settings>

export const RepoInput = z.object({
  path: z.string().min(1),
  setupScript: z.string().default(''),
  archiveScript: z.string().default(''),
  featureBase: z.string().min(1),
  sharedDirs: z.array(z.string()).default([]),
})
export type RepoInput = z.input<typeof RepoInput>

export const Repo = RepoInput.extend({ id: z.string(), name: z.string(), createdAt: isoDate })
export type Repo = z.infer<typeof Repo>

export const LoginStatus = z.enum(['logged_in', 'logged_out', 'unknown', 'error'])
export type LoginStatus = z.infer<typeof LoginStatus>

/** An account is a folder holding an agent CLI login. Fitrah never stores tokens. */
export const Account = z.object({
  id: z.string(),
  agent: AgentId,
  label: z.string(),
  kind: z.enum(['attached', 'managed']),
  configDir: z.string(),
  email: nullableText,
  loginExpiresAt: nullableText,
  loginStatus: LoginStatus,
  warning: nullableText,
  isDefault: z.boolean(),
  lastCheckedAt: nullableText,
})
export type Account = z.infer<typeof Account>

export const DetectedLogin = z.object({ agent: AgentId, configDir: z.string(), attached: z.boolean() })
export type DetectedLogin = z.infer<typeof DetectedLogin>

export const WorkspaceKind = z.enum(['feature', 'defect'])
export type WorkspaceKind = z.infer<typeof WorkspaceKind>

export const WorkspaceStatus = z.enum(['idle', 'working', 'needs_approval', 'waiting', 'done', 'error'])
export type WorkspaceStatus = z.infer<typeof WorkspaceStatus>

export const WorkspaceInput = z.object({
  repoId: z.string().min(1),
  kind: WorkspaceKind,
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, numbers and dashes'),
  /** Required: Fitrah never guesses the base branch (OQ-13). */
  base: z.string().min(1),
  iteration: z.string().optional(),
  module: z.string().optional(),
  prdUrl: z.string().optional(),
  figmaUrl: z.string().optional(),
})
export type WorkspaceInput = z.infer<typeof WorkspaceInput>

export const Workspace = WorkspaceInput.extend({
  id: z.string(),
  branch: z.string(),
  worktreePath: z.string(),
  stage: z.string(),
  setupStatus: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  status: WorkspaceStatus,
  createdAt: isoDate,
  archivedAt: nullableText,
})
export type Workspace = z.infer<typeof Workspace>

export const ChatStatus = WorkspaceStatus
export type ChatStatus = WorkspaceStatus

export const ChatInput = z.object({
  workspaceId: z.string(),
  agent: AgentId,
  accountId: z.string(),
  model: z.string().min(1),
  title: z.string().optional(),
})
export type ChatInput = z.infer<typeof ChatInput>

export const Chat = z.object({
  id: z.string(),
  workspaceId: z.string(),
  agent: AgentId,
  accountId: nullableText,
  model: z.string(),
  sessionId: nullableText,
  permissionMode: z.string(),
  status: ChatStatus,
  title: z.string(),
  createdAt: isoDate,
  lastActiveAt: nullableText,
})
export type Chat = z.infer<typeof Chat>

export const DocNode: z.ZodType<DocNodeT> = z.lazy(() =>
  z.object({ name: z.string(), path: z.string(), dir: z.boolean(), children: z.array(DocNode).optional() }),
)
export type DocNodeT = { name: string; path: string; dir: boolean; children?: DocNodeT[] }
