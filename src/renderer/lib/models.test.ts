import { describe, expect, it } from 'vitest'
import { modelInfo } from './models'

describe('modelInfo', () => {
  it('names aliases and full ids', () => {
    expect(modelInfo('opus')).toEqual({ name: 'Claude Opus', description: 'For complex work and everyday tasks' })
    expect(modelInfo('claude-sonnet-5-5').name).toBe('Claude Sonnet 5.5')
    expect(modelInfo('my-model')).toEqual({ name: 'my-model', description: '' })
  })
})
