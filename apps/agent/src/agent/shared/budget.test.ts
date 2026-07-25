import { isStopConditionMet } from '@openrouter/agent'
import { describe, expect, it } from 'vitest'

import {
  type Budget,
  type BudgetPool,
  budgetStopWhen,
  createPool,
  finalizeBudget,
} from './budget'

const BUDGET: Budget = { softLimitUsd: 0.15, hardLimitUsd: 0.3 }
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
    expect(finalizeBudget(spent(0.1), BUDGET).hardLimitUsd).toBe(
      BUDGET.hardLimitUsd,
    )
  })

  it('lifts the ceiling clear of an exhausted pool', () => {
    expect(finalizeBudget(spent(0.3), BUDGET).hardLimitUsd).toBeCloseTo(0.45)
  })

  it('honours an explicit reserve over the default fraction', () => {
    const budget: Budget = { ...BUDGET, reserveUsd: 0.02 }
    expect(finalizeBudget(spent(0.3), budget).hardLimitUsd).toBeCloseTo(0.32)
  })

  it('keeps the soft limit where it was', () => {
    expect(finalizeBudget(spent(0.3), BUDGET).softLimitUsd).toBe(
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
    await expect(stoppedAtStart(spent(0.3), BUDGET)).resolves.toBe(true)
  })

  it('can still take a turn on the finalize budget', async () => {
    const pool = spent(0.3)
    await expect(
      stoppedAtStart(pool, finalizeBudget(pool, BUDGET)),
    ).resolves.toBe(false)
  })
})
