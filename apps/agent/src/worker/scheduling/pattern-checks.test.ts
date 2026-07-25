import { describe, expect, it } from 'vitest'

import { isCronExpression, isTimeZone } from './pattern-checks'

describe('isCronExpression', () => {
  it('accepts a five-field pattern', () => {
    expect(isCronExpression('0 7 * * *')).toBe(true)
  })

  it('accepts croner’s optional seconds field', () => {
    expect(isCronExpression('*/30 * * * * *')).toBe(true)
  })

  it('rejects prose and an out-of-range field', () => {
    expect(isCronExpression('every morning')).toBe(false)
    expect(isCronExpression('0 99 * * *')).toBe(false)
  })
})

/** croner accepts an unknown zone silently, which is why this check exists. */
describe('isTimeZone', () => {
  it('accepts an IANA zone', () => {
    expect(isTimeZone('Europe/Prague')).toBe(true)
  })

  it('rejects one that does not exist', () => {
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })
})
