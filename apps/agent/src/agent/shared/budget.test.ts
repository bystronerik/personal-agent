import { isStopConditionMet } from '@openrouter/agent'
import { describe, expect, it } from 'vitest'

import {
  type Budget,
  type BudgetPool,
  budgetStopWhen,
  createPool,
  DEFAULT_BUDGET,
  finalizeBudget,
} from './budget'

const BUDGET = DEFAULT_BUDGET
const HARD = BUDGET.hardLimitUsd
/** The pool a hard stop leaves behind: exactly at the ceiling. */
const EXHAUSTED = HARD
const MAX_STEPS = 12

const spent = (usd: number): BudgetPool => {
  const pool = createPool()
  pool.record(usd)
  return pool
}

/** What a loop's stop conditions answer before it has taken a single turn. */
const stoppedAtStart = (pool: BudgetPool, budget: Budget) =>
  isStopConditionMet({
    stopConditions: budgetStopWhen(pool, budget, MAX_STEPS),
    steps: [],
  })

describe('finalizeBudget', () => {
  it('leaves a run that stayed under the ceiling alone', () => {
    expect(finalizeBudget(spent(HARD / 2), BUDGET).hardLimitUsd).toBe(HARD)
  })

  it('lifts the ceiling clear of an exhausted pool', () => {
    // The documented default reserve: half the hard limit, on top of the spend.
    expect(finalizeBudget(spent(EXHAUSTED), BUDGET).hardLimitUsd).toBeCloseTo(
      EXHAUSTED + HARD / 2,
    )
  })

  it('honours an explicit reserve over the default fraction', () => {
    const reserveUsd = HARD / 10
    const budget: Budget = { ...BUDGET, reserveUsd }
    expect(finalizeBudget(spent(EXHAUSTED), budget).hardLimitUsd).toBeCloseTo(
      EXHAUSTED + reserveUsd,
    )
  })

  it('keeps the soft limit where it was', () => {
    expect(finalizeBudget(spent(EXHAUSTED), BUDGET).softLimitUsd).toBe(
      BUDGET.softLimitUsd,
    )
  })
})

/**
 * The guarantee `runBrief`'s finalize is written to make. Every loop stops on
 * the *shared* pool, so the hard stop that halted the orchestrator is already
 * true for the nested research the finalize depends on: without the reserve it
 * is stopped before its first turn, `runResearch` throws "research finished
 * without recording findings", and the one case the finalize exists for is the
 * one it fails.
 */
describe('the finalize path', () => {
  it('is stopped before its first turn on the exhausted budget', async () => {
    await expect(stoppedAtStart(spent(EXHAUSTED), BUDGET)).resolves.toBe(true)
  })

  it('can still take a turn on the finalize budget', async () => {
    const pool = spent(EXHAUSTED)
    await expect(
      stoppedAtStart(pool, finalizeBudget(pool, BUDGET)),
    ).resolves.toBe(false)
  })
})
