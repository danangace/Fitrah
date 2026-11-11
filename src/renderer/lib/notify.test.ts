import { describe, expect, it } from 'vitest'
import { notificationFor } from './notify'

describe('notificationFor', () => {
  it('notifies only while hidden, for states that need attention (AC-N2)', () => {
    expect(notificationFor('needs_approval', true)).toBe('Claude needs your approval')
    expect(notificationFor('done', true)).toBe('Claude is done')
    expect(notificationFor('needs_approval', false)).toBeNull()
    expect(notificationFor('working', true)).toBeNull()
  })
})
