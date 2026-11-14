import type { ReactNode } from 'react'
import { AccountSettings } from '../components/settings/AccountSettings'
import { ConnectorSettings } from '../components/settings/ConnectorSettings'
import { DocsSettings } from '../components/settings/DocsSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { ModelSettings } from '../components/settings/ModelSettings'
import { WorkflowSettings } from '../components/workflows/WorkflowSettings'
import { type SettingsSectionId, SETTINGS_SECTIONS, resolveSettingsSection } from '../lib/settings-sections'

const RENDER: Record<SettingsSectionId, () => ReactNode> = {
  general: () => <GeneralSettings />,
  workflows: () => <WorkflowSettings />,
  accounts: () => <AccountSettings />,
  models: () => <ModelSettings />,
  docs: () => <DocsSettings />,
  connectors: () => <ConnectorSettings />,
}

/** Renders the selected section; the section list lives in SettingsSidebar. */
export function SettingsPage({ section }: { section: string }) {
  const id = resolveSettingsSection(section)
  const label = SETTINGS_SECTIONS.find((s) => s.id === id)?.label
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-foreground">{label}</h1>
      {RENDER[id]()}
    </div></div>
  )
}
