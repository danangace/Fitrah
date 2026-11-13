import { describe, expect, it } from 'vitest'
import { appTitle } from './app-info'

describe('app-info', () => {
  it('builds the title from name and tagline', () => {
    expect(appTitle()).toBe("Nakoda: You're the captain, the agents are your crew")
  })
})
