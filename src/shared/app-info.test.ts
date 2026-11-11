import { describe, expect, it } from 'vitest'
import { APP_INFO, appTitle } from './app-info'

describe('app-info', () => {
  it('spells FITRAH with the acronym initials', () => {
    const initials = APP_INFO.acronym
      .split(/[\s,&]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
    expect(initials).toBe('FITRAH')
  })

  it('builds the title from name and acronym', () => {
    expect(appTitle()).toBe('Fitrah: Finance Iteration Tools, Review & Agent Hub')
  })
})
