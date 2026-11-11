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
  models: z.object({ claude: AgentModels }).catchall(AgentModels),
  openIn: OpenIn.default({ kind: 'default' }),
})
export type Settings = z.infer<typeof Settings>

export const RepoInput = z.object({
  path: z.string().min(1),
  setupScript: z.string().default(''),
  archiveScript: z.string().default(''),
  /** Default base for new workspaces, e.g. `origin/dev/tribe-2`. */
  featureBase: z.string().min(1),
  /** Branch name = prefix + workspace name, e.g. `feat/tribe-2/` + `rapikan-tabel`. */
  branchPrefix: z.string().default(''),
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

export const WorkspaceStatus = z.enum(['idle', 'working', 'needs_approval', 'waiting', 'done', 'error'])
export type WorkspaceStatus = z.infer<typeof WorkspaceStatus>

/** Field types a workflow can ask for (D-16). */
export const FieldType = z.enum(['text', 'link', 'docsFolder', 'branch', 'choice'])
export type FieldType = z.infer<typeof FieldType>

export const WorkflowField = z.object({
  /** Stable id used to store values. */
  key: z.string().regex(/^[a-z0-9_]+$/, 'key: lowercase letters, numbers, _'),
  /** Shown in the modal and usable in instructions as {Label}. */
  label: z.string().min(1),
  type: FieldType,
  required: z.boolean().default(false),
  default: z.string().optional(),
  help: z.string().optional(),
  /** Choices for type `choice`. */
  options: z.array(z.string().min(1)).optional(),
})
export type WorkflowField = z.infer<typeof WorkflowField>

export const WorkflowInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(''),
  fields: z.array(WorkflowField),
  instructions: z.string().default(''),
})
export type WorkflowInput = z.input<typeof WorkflowInput>

export const Workflow = WorkflowInput.extend({ id: z.string(), createdAt: isoDate, updatedAt: isoDate })
export type Workflow = z.infer<typeof Workflow>

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, numbers and dashes')

export const WorkspaceInput = z.object({
  repoId: z.string().min(1),
  /** Optional; Fitrah generates one when empty. */
  name: slug.optional(),
  /** null / missing = Free chat. */
  workflowId: z.string().nullable().optional(),
  values: z.record(z.string(), z.string()).default({}),
  /** Advanced: override the base branch. */
  base: z.string().optional(),
})
export type WorkspaceInput = z.input<typeof WorkspaceInput>

export const Workspace = z.object({
  id: z.string(),
  repoId: z.string(),
  name: z.string(),
  workflowId: nullableText,
  values: z.record(z.string(), z.string()),
  branch: z.string(),
  base: z.string(),
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
