import { describe, expect, it } from 'vitest'
import { ACRONYM_PARTS, APP_INFO, appTitle } from './app-info'

describe('app-info', () => {
  it('spells FITRAH with the highlighted letters of the acronym', () => {
    expect(ACRONYM_PARTS.map(([letters]) => letters).join('')).toBe('FITRAH')
    expect(APP_INFO.name.toUpperCase()).toBe('FITRAH')
  })

  it('builds the title from name and acronym', () => {
    expect(APP_INFO.acronym).toBe('Finance ITeration, Review and Agents Hub')
    expect(appTitle()).toBe('Fitrah: Finance ITeration, Review and Agents Hub')
  })
})
