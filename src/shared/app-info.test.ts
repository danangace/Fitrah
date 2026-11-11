import { describe, expect, it } from 'vitest'
import { appTitle } from './app-info'

describe('app-info', () => {
  it('builds the title from name and acronym', () => {
    expect(appTitle()).toBe('Fitrah: Finance Iteration Tools, Review & Agent Hub')
  })
})
