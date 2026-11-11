import { describe, expect, it } from 'vitest'
import { keyFromLabel, parseOptions } from './workflow-form'

describe('workflow form helpers', () => {
  it('makes unique snake_case keys from labels', () => {
    expect(keyFromLabel('Target docs', [])).toBe('target_docs')
    expect(keyFromLabel('PRD', ['prd'])).toBe('prd_2')
    expect(keyFromLabel('???', [])).toBe('field')
  })

  it('parses comma-separated choices', () => {
    expect(parseOptions('dev, staging ,,prod')).toEqual(['dev', 'staging', 'prod'])
  })
})
