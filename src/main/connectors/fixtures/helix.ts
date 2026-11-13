/** Sanitized copies of real Helix answers (shapes verified 2026-11-13). Names, titles and ids are made up. */
export const ME = {
  data: { id: 7, name: 'Ada Lovelace', username: 'ada.l', email: 'ada@example.test', active: true, token: { scope: 'read_only', capabilities: ['read'], expires_at: '2027-09-01T00:00:00Z' } },
}

export const BOARDS = { data: [{ id: 4, name: 'TRIBE 2', prefix: 'T2' }, { id: 5, name: 'SandBox', prefix: 'SB' }] }

export const MILESTONES = {
  data: [
    { id: 95, board_id: 4, name: 'Iteration 15', status: 'active' },
    { id: 82, board_id: 4, name: 'Iteration 14b', status: 'closed' },
  ],
}

export const SEARCH = {
  data: [
    { id: 1, ticket_key: 'T2-3672', title: '[FE] Link redirect after login', type: 'defect_staging', status: 'ready_to_test', priority: 'medium', board_id: 4, board_name: 'TRIBE 2', assignee: { id: 7, name: 'Ada Lovelace', username: 'ada.l' }, due_date: null, milestone_id: 95, milestone_name: 'Iteration 15', archived: false },
    { id: 2, ticket_key: 'T2-3252', title: 'Invoice Management - Phase 1', type: 'story', status: 'done', priority: 'high', board_id: 4, board_name: 'TRIBE 2', assignee: { id: 7, name: 'Ada Lovelace', username: 'ada.l' }, due_date: '2026-10-12T00:00:00Z', milestone_id: 82, milestone_name: 'Iteration 14b', archived: false },
    { id: 3, ticket_key: 'T2-1', title: 'Old and archived', type: 'task', status: 'done', priority: 'low', board_id: 4, board_name: 'TRIBE 2', assignee: null, due_date: null, milestone_id: null, milestone_name: null, archived: true },
  ],
  limit: 50,
  page: 1,
  total: 3,
}

const doc = (...paras: string[]) => ({ type: 'doc', content: paras.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) })

export const STORY = {
  data: {
    id: 2,
    ticket_key: 'T2-3252',
    type: 'story',
    title: 'Invoice Management - Phase 1',
    status: 'done',
    priority: 'high',
    severity: null,
    environment: '',
    milestone: { id: 82, name: 'Iteration 14b', status: 'closed' },
    board: { id: 4, name: 'TRIBE 2' },
    objective: doc('Let finance manage invoices'),
    scope: doc('List', 'Detail'),
    acceptance_criteria: doc('Totals match'),
    fields: [
      { ticket_id: 2, field_key: 'prd_links', field_value: 'https://docs.example.test/prd-1, https://docs.example.test/prd-2' },
      { ticket_id: 2, field_key: 'figma_links', field_value: 'https://www.figma.com/design/abc/invoices' },
    ],
  },
}

export const DEFECT = {
  data: {
    id: 1,
    ticket_key: 'T2-3672',
    type: 'defect_staging',
    title: '[FE] Link redirect after login',
    status: 'ready_to_test',
    priority: 'medium',
    severity: 'medium',
    environment: '',
    milestone: { id: 95, name: 'Iteration 15', status: 'active' },
    board: { id: 4, name: 'TRIBE 2' },
    steps_to_reproduce: doc('1. Open the emailed link while logged out'),
    expected_behavior: doc('Land on the page after login'),
    actual_behavior: doc('Land on the dashboard'),
    fields: [],
  },
}
