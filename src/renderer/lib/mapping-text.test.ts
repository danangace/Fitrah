import { describe, expect, it } from 'vitest'
import { formatMap, parseMap } from './mapping-text'

describe('mapping text', () => {
  it('round-trips and ignores broken lines', () => {
    expect(parseMap('high = major\nbroken\n=x\ny=\nlow=minor')).toEqual({ high: 'major', low: 'minor' })
    expect(parseMap(formatMap({ a: 'b', c: 'd' }))).toEqual({ a: 'b', c: 'd' })
  })
})
