import { describe, expect, it } from 'vitest'

import { referenceBrief } from '../../fixtures/brief-good'
import type { Brief } from '../../schema'
import { formatBrief } from './format'

const resolving = (resolvesAt: string): Brief => ({
  ...referenceBrief,
  prediction: { ...referenceBrief.prediction, resolvesAt },
})

describe('formatBrief', () => {
  it('attributes every headline to the sources it was built from', () => {
    const text = formatBrief(referenceBrief, 'Europe/Prague')

    for (const story of referenceBrief.headlines) {
      expect(text).toContain(`Sources: ${story.sourceIds.join(', ')}`)
    }
  })

  it('renders a timestamp in the schedule’s zone', () => {
    const text = formatBrief(
      resolving('2026-07-21T20:00:00Z'),
      'America/New_York',
    )

    expect(text).toContain('resolves 21 Jul 2026')
  })

  /** A date-only value names a day, not an instant — UTC midnight must not shift it. */
  it('keeps a date-only resolution on the day the model named', () => {
    const text = formatBrief(resolving('2026-07-30'), 'America/New_York')

    expect(text).toContain('resolves 30 Jul 2026')
  })
})
