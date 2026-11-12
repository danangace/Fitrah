/** Last folder of an account's config dir, which is how you tell logins apart: `/Users/x/.claude-sid` → `.claude-sid`. */
export function configDirName(configDir: string): string {
  return configDir.replace(/\/+$/, '').split('/').at(-1) || configDir
}

/** Short name for an account: your own name once you renamed it ("Sekolahmu"), else its folder (".claude-sid"). */
export function accountName(label: string | null | undefined, configDir: string): string {
  const folder = configDirName(configDir)
  return label?.trim() || folder
}
