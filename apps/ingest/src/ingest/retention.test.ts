import { describe, expect, it } from 'vitest'

import { retentionCutoff } from './retention'

describe('retentionCutoff', () => {
  it('is the given number of days before now', () => {
    expect(retentionCutoff(30, new Date('2026-07-27T00:00:00Z'))).toEqual(
      new Date('2026-06-27T00:00:00Z'),
    )
  })

  /** The poller reuses this to drop feed items it would only sweep again. */
  it('crosses a DST boundary by elapsed time, not by wall clock', () => {
    expect(retentionCutoff(1, new Date('2026-03-29T12:00:00Z'))).toEqual(
      new Date('2026-03-28T12:00:00Z'),
    )
  })
})
