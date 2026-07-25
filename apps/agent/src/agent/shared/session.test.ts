import { describe, expect, it } from 'vitest'

import { briefSessionId, evalSessionId } from './session'

/** OpenRouter's cap on `session_id`. */
const MAX_LENGTH = 256
const SUFFIX = /-[0-9a-f]{6}$/

describe('briefSessionId', () => {
  it('names the edition and the timestamp, slugified', () => {
    expect(
      briefSessionId({ edition: 'morning', asOf: '2026-07-25T06:00:00Z' }),
    ).toMatch(/^brief-morning-2026-07-25T06-00-00Z-[0-9a-f]{6}$/)
  })

  it('truncates description rather than the suffix', () => {
    // Defensive only: no `asOf` this schema accepts comes near the cap.
    const id = briefSessionId({
      edition: 'morning',
      asOf: 'x'.repeat(MAX_LENGTH),
    })
    expect(id).toHaveLength(MAX_LENGTH)
    expect(id).toMatch(SUFFIX)
  })
})

describe('evalSessionId', () => {
  it('names the layer and trial, and no model', () => {
    expect(evalSessionId('prediction', 3)).toMatch(
      /^eval-prediction-t3-[0-9a-f]{12}$/,
    )
  })

  it('never repeats an id for one layer and trial', () => {
    const ids = new Set(
      Array.from({ length: 100 }, () => evalSessionId('research', 1)),
    )
    expect(ids.size).toBe(100)
  })
})
