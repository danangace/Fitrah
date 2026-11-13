import { type HelixTicket } from './helix'

/** Editable on the connection: how Helix words map to Nakoda's. */
export type Mappings = { severity: Record<string, string>; environment: Record<string, string> }

export const DEFAULT_MAPPINGS: Mappings = {
  // Helix severity → Nakoda (intake checklist) severity.
  severity: { critical: 'critical', high: 'major', medium: 'minor', low: 'minor' },
  // Helix ticket type → environment. Only staging is known; the rest stays empty for a human.
  environment: { defect_staging: 'staging' },
}

/** Folder-safe name from a title: "[FE] Link redirect!" → "fe-link-redirect". */
export function slug(text: string, max = 40): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '')
}

/** The first Figma link if there is one, otherwise the first link. */
const pickFigma = (links: string[]): string => links.find((l) => /figma\.com/i.test(l)) ?? links[0] ?? ''

export type TransferInput = {
  title: string
  description: string
  priority: string
  kind: 'task' | 'defect'
  repoId: string | null
  workflowId: string | null
  values: Record<string, string>
}

/** What a Helix ticket becomes on our board: a TaskInput (plus where it came from). */
export function toTaskInput(ticket: HelixTicket, mappings: Mappings, workflowIds: { planning: string | null; defect: string | null }, repoId: string | null): TransferInput {
  const figma = pickFigma(ticket.figmaLinks)
  const prd = ticket.prdLinks[0] ?? ''
  // Links beyond the first PRD / Figma are "other references".
  const others = [...ticket.prdLinks.filter((l) => l !== prd), ...ticket.figmaLinks.filter((l) => l !== figma)]
  const common = { title: ticket.title, priority: ticket.priority ?? '', kind: ticket.kind, repoId }

  if (ticket.kind === 'defect') {
    return {
      ...common,
      description: ticket.description,
      workflowId: workflowIds.defect,
      values: {
        defect: slug(ticket.title),
        environment: mappings.environment[ticket.type] ?? '',
        severity: mappings.severity[ticket.severity ?? ''] ?? '',
        iteration: ticket.iteration ?? '',
        steps: ticket.sections.steps_to_reproduce ?? '',
        expected: ticket.sections.expected_behavior ?? '',
        actual: ticket.sections.actual_behavior ?? '',
        // A defect keeps every link it came with.
        references: [prd, figma, ...others].filter(Boolean).join('\n'),
      },
    }
  }
  const extra = others.length ? `\n\n## Other references\n\n${others.map((l) => `- ${l}`).join('\n')}` : ''
  return {
    ...common,
    description: ticket.description + extra,
    workflowId: workflowIds.planning,
    // Module is not in the ticket; the readiness badge asks for it.
    values: { prd, figma, iteration: ticket.iteration ?? '', module: '' },
  }
}
