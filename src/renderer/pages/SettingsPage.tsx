import type { ReactNode } from 'react'
import { AccountSettings } from '../components/settings/AccountSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { ModelSettings } from '../components/settings/ModelSettings'
import { WorkflowSettings } from '../components/workflows/WorkflowSettings'
import { cn } from '../lib/cn'
import { useRouter } from '../store/router'

const SECTIONS: { id: string; label: string; render: () => ReactNode }[] = [
  { id: 'general', label: 'General', render: () => <GeneralSettings /> },
  { id: 'workflows', label: 'Workflows', render: () => <WorkflowSettings /> },
  { id: 'accounts', label: 'Accounts', render: () => <AccountSettings /> },
  { id: 'models', label: 'Models', render: () => <ModelSettings /> },
]

export function SettingsPage({ section }: { section: string }) {
  const navigate = useRouter((s) => s.navigate)
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-white">Settings</h1>
      <div className="flex gap-1 border-b border-neutral-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate({ name: 'settings', section: s.id })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              s.id === active?.id ? 'border-emerald-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {active?.render()}
    </div></div>
  )
}
