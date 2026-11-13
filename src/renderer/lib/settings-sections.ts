/** Settings sections, shared by the sidebar and the page so they cannot drift apart. */
export const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'models', label: 'Models' },
  { id: 'connectors', label: 'Connectors' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

/** Falls back to the first section for unknown ids (keeps old links working). */
export function resolveSettingsSection(id: string): SettingsSectionId {
  return SETTINGS_SECTIONS.find((s) => s.id === id)?.id ?? SETTINGS_SECTIONS[0].id
}
