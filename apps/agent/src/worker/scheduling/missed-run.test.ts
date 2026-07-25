import { describe, expect, it } from 'vitest'

import { CATCHUP_GRACE_MINUTES, missedRun } from './missed-run'

describe('missedRun', () => {
  const occurrence = new Date('2026-07-26T05:00:00Z')
  const within = new Date('2026-07-26T05:20:00Z')
  const beyond = new Date('2026-07-26T09:00:00Z')

  it('runs an occurrence missed inside the grace window', () => {
    expect(missedRun(occurrence, null, within)).toBe(true)
  })

  it('skips one missed by more than the grace window', () => {
    expect(missedRun(occurrence, null, beyond)).toBe(false)
  })

  /** The idempotence that makes catch-up safe across repeated restarts. */
  it('skips an occurrence already run', () => {
    const ranAt = new Date('2026-07-26T05:00:12Z')
    expect(missedRun(occurrence, ranAt, within)).toBe(false)
  })

  it('runs again when the last run predates the occurrence', () => {
    const yesterday = new Date('2026-07-25T05:00:10Z')
    expect(missedRun(occurrence, yesterday, within)).toBe(true)
  })

  it('has nothing to catch up on a pattern with no past occurrence', () => {
    expect(missedRun(null, null, within)).toBe(false)
  })

  it('treats the grace boundary as still inside', () => {
    const edge = new Date(occurrence.getTime() + CATCHUP_GRACE_MINUTES * 60_000)
    expect(missedRun(occurrence, null, edge)).toBe(true)
    expect(missedRun(occurrence, null, new Date(edge.getTime() + 1))).toBe(
      false,
    )
  })

  /** What the caller passes when nothing has run: a row cannot miss its own past. */
  it('skips an occurrence older than the schedule itself', () => {
    const createdAt = new Date('2026-07-26T05:10:00Z')
    expect(missedRun(occurrence, createdAt, within)).toBe(false)
  })
})
