import { describe, expect, it } from 'vitest'

import { previousOccurrence } from './occurrences'
import type { ScheduleDefinition } from './schedules'

const morning: ScheduleDefinition = {
  id: 'one',
  cron: '0 7 * * *',
  timezone: 'Europe/Prague',
  edition: 'morning',
  lastRunAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
}

describe('occurrences', () => {
  /** 07:00 in Prague is 05:00Z in July — the zone is applied, not ignored. */
  it('reads the occurrence before a given moment', () => {
    const from = new Date('2026-07-26T09:30:00Z')
    expect(previousOccurrence(morning, from)?.toISOString()).toBe(
      '2026-07-26T05:00:00.000Z',
    )
  })

  /** croner searches back from a whole second earlier — hence the offset. */
  it('counts an occurrence in the same second as the moment asked about', () => {
    const booted = new Date('2026-07-26T05:00:00.400Z')
    expect(previousOccurrence(morning, booted)?.toISOString()).toBe(
      '2026-07-26T05:00:00.000Z',
    )
  })

  it('never reads an occurrence still in the future', () => {
    const justBefore = new Date('2026-07-26T04:59:59.500Z')
    expect(previousOccurrence(morning, justBefore)?.toISOString()).toBe(
      '2026-07-25T05:00:00.000Z',
    )
  })
})
