/** Last folder of an account's config dir, which is how you tell logins apart: `/Users/x/.claude-sid` → `.claude-sid`. */
export function configDirName(configDir: string): string {
  return configDir.replace(/\/+$/, '').split('/').at(-1) || configDir
}
