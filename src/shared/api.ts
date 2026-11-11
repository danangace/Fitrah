/** HTTP routes of the runtime, shared by server and client. */
export const API = {
  health: '/api/health',
  session: '/api/session',
  settings: '/api/settings',
  repos: '/api/repos',
  accounts: '/api/accounts',
  accountsDetect: '/api/accounts/detect',
  docsTree: '/api/docs/tree',
  docsFile: '/api/docs/file',
  docsAsset: '/api/docs/asset',
  docsResolve: '/api/docs/resolve',
  workspaces: '/api/workspaces',
  chats: '/api/chats',
  events: '/api/events',
  chatSocket: '/ws/chat',
} as const
