import { describe, expect, it } from 'vitest'

import {
  type BriefInput,
  BriefInputSchema,
  type Prediction,
  PredictionSchema,
} from '../schema'
import {
  type CheckResult,
  claimedValuesIn,
  PREDICTION_CHECKS,
  sourceValuesIn,
} from './checks'

const values = (text: string): number[] =>
  claimedValuesIn(text).map((claim) => claim.value)

describe('claimedValuesIn', () => {
  it('reads a plain integer', () => {
    expect(values('rose 12 percent')).toEqual([12])
  })

  it('strips comma grouping', () => {
    expect(values('310,000 jobs')).toEqual([310_000])
  })

  it('keeps decimals', () => {
    expect(values('held at 4.25 percent')).toEqual([4.25])
  })

  it('applies a spelled-out scale word', () => {
    expect(values('890 million credits')).toEqual([890_000_000])
  })

  it('applies an abbreviated scale word', () => {
    expect(values('2.5bn')).toEqual([2_500_000_000])
    expect(values('40k')).toEqual([40_000])
  })

  it('reads every number in a sentence', () => {
    expect(values('rose 64 percent over 9 days')).toEqual([64, 9])
  })

  it('ignores spelled-out numbers', () => {
    expect(values('three carriers suspended transits')).toEqual([])
  })

  it('ignores an ordinal, which is not a standalone figure', () => {
    expect(values('the 3rd month in a row')).toEqual([])
  })

  it('rounds away the drift scale multiplication introduces', () => {
    expect(16.1 * 1e3).not.toBe(16_100)
    expect(values('16.1 thousand units')).toEqual([16_100])
  })
})

describe('sourceValuesIn', () => {
  it('offers both readings of a scaled number', () => {
    expect(sourceValuesIn('890 million credits')).toEqual([890_000_000, 890])
  })

  it('offers a single reading of an unscaled number', () => {
    expect(sourceValuesIn('rose 12 percent')).toEqual([12])
  })
})

const inputWith = (body: string): BriefInput =>
  BriefInputSchema.parse({
    edition: 'morning',
    asOf: '2026-07-20T06:00:00Z',
    docs: [
      {
        id: 'doc-01',
        title: 'Synthetic test document',
        body,
        publishedAt: '2026-07-19T09:00:00Z',
      },
    ],
  })

const predictionWith = (rationale: string): Prediction =>
  PredictionSchema.parse({
    instrument: 'SPX',
    direction: 'up',
    confidence: 0.6,
    resolvesAt: '2026-07-22T06:00:00Z',
    rationale,
  })

const check = PREDICTION_CHECKS.find(
  (candidate) => candidate.checkName === 'numbersGrounded',
)
if (!check) throw new Error('PREDICTION_CHECKS no longer has numbersGrounded')

const grounded = (rationale: string, sourceBody: string): CheckResult =>
  check(predictionWith(rationale), inputWith(sourceBody))

describe('numbersGrounded', () => {
  const PAYROLLS = 'Payrolls rose by 310 thousand in June.'

  it('scores prose with no numbers as fully grounded', () => {
    expect(
      grounded('Momentum favours the index into the end of the week.', PAYROLLS)
        .score,
    ).toBe(1)
  })

  it('accepts a scaled source figure restated in full', () => {
    expect(
      grounded('Payrolls at 310,000 argue for a firmer index.', PAYROLLS).score,
    ).toBe(1)
  })

  it('accepts the same scale word the source used', () => {
    expect(
      grounded('Payrolls at 310 thousand argue for a firmer index.', PAYROLLS)
        .score,
    ).toBe(1)
  })

  it('rejects the wrong scale', () => {
    const result = grounded(
      'Payrolls at 310 million argue for a firmer index.',
      PAYROLLS,
    )
    expect(result.score).toBe(0)
    expect(result.details).toEqual([
      '"310 million" does not appear in any source document',
    ])
  })

  it('matches across the float-drift boundary', () => {
    expect(
      grounded(
        'Volumes near 16.1 thousand keep freight pricing firm.',
        'Container volumes reached 16,100 units this month.',
      ).score,
    ).toBe(1)
  })

  it('awards partial credit per grounded figure', () => {
    expect(
      grounded(
        'Revenue of 890 million and growth of 12 percent, across 47 new sites.',
        'Revenue was 890 million credits, up 12 percent.',
      ).score,
    ).toBeCloseTo(2 / 3)
  })

  // The two documented false positives. Both are accepted: this check
  // contributes a score rather than gating, precisely because of them.
  it('flags a rounded restatement of a source figure', () => {
    expect(
      grounded(
        'With the rate about 4 percent, the index should drift higher.',
        'The policy rate held at 4.25 percent on Thursday.',
      ).score,
    ).toBe(0)
  })

  it('flags a derived figure the source never states outright', () => {
    expect(
      grounded(
        'A third straight quarter above 10 percent growth favours the index.',
        'Revenue was 890 million credits, up 12 percent.',
      ).score,
    ).toBe(0)
  })
})
