import { describe, expect, it } from 'vitest'
import type { Task } from '../../shared/tasks'
import { activeTaskIn, defaultWorkflowId, groupByColumn } from './tasks-board'

const task = (over: Partial<Task>): Task => ({
  id: 'a', title: 'A', description: '', kind: 'task', column: 'backlog', position: 0, priority: '', repoId: null, workflowId: null,
  values: {}, source: 'manual', externalId: null, externalUrl: null, workspaceId: null, createdAt: '', updatedAt: '', ...over,
})

describe('tasks board helpers', () => {
  it('groups tickets into the four columns, keeping order', () => {
    const g = groupByColumn([task({ id: '1' }), task({ id: '2', column: 'done' }), task({ id: '3' })])
    expect(g.backlog.map((t) => t.id)).toEqual(['1', '3'])
    expect(g.done.map((t) => t.id)).toEqual(['2'])
    expect(g.in_progress).toEqual([])
    expect(g.review).toEqual([])
  })

  it('finds the ticket that keeps a workspace busy, ignoring Review, Done and the ticket itself', () => {
    const all = [task({ id: '1', workspaceId: 'w', column: 'in_progress' }), task({ id: '2', workspaceId: 'w', column: 'review' }), task({ id: '3', workspaceId: 'x', column: 'in_progress' })]
    expect(activeTaskIn(all, 'w')?.id).toBe('1')
    expect(activeTaskIn(all, 'w', '1')).toBeUndefined()
    expect(activeTaskIn(all, 'y')).toBeUndefined()
  })

  it('defaults to the Planning workflow only when it exists', () => {
    expect(defaultWorkflowId([{ id: 'planning' }, { id: 'x' }])).toBe('planning')
    expect(defaultWorkflowId([{ id: 'x' }])).toBeNull()
  })
})
