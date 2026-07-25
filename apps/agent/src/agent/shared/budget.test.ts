import { isStopConditionMet, type StepResult } from '@openrouter/agent'
import { describe, expect, it } from 'vitest'

import {
  type Budget,
  type BudgetPool,
  createPool,
  DEFAULT_BUDGET,
  finalizeBudget,
  type LoopMeter,
  meterLoop,
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

/**
 * A completed round as a stop condition sees it. Only `usage` is read here, and
 * the real shape is the SDK's whole turn record — far more than a meter needs.
 */
const step = (costUsd: number): StepResult =>
  ({ usage: { cost: costUsd } }) as unknown as StepResult

/** A settled `callModel` result whose final response cost this much. */
const loopEndingAt = (costUsd: number) => ({
  getResponse: async () => ({ usage: { cost: costUsd } }),
})

/** What a loop's stop conditions answer before it has taken a single turn. */
const stoppedAtStart = (pool: BudgetPool, budget: Budget) =>
  isStopConditionMet({
    stopConditions: meterLoop(pool, budget, MAX_STEPS).stopWhen,
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

/**
 * `callModel` fires `onTurnEnd` only after a follow-up request, so a loop's
 * initial turn never reaches it. Metering that callback alone dropped exactly
 * one turn per loop: the pool under-reported the run, and `finalizeBudget`
 * computed its reserve from the wrong base.
 */
describe('meterLoop', () => {
  /** One evaluation of the stop conditions, as the SDK does it between turns. */
  const evaluate = (meter: LoopMeter, steps: StepResult[]) =>
    isStopConditionMet({ stopConditions: meter.stopWhen, steps })

  it('counts the initial turn the loop only exposes through steps', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    await evaluate(meter, [step(0.02)])

    expect(pool.spentUsd).toBeCloseTo(0.02)
  })

  it('counts that turn once, however often the conditions are evaluated', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    await evaluate(meter, [step(0.02)])
    await evaluate(meter, [step(0.02), step(0.03)])
    await evaluate(meter, [step(0.02), step(0.03)])

    expect(pool.spentUsd).toBeCloseTo(0.02)
  })

  it('totals the whole loop: the initial turn plus every follow-up', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    // Turn 0 reaches the pool through the steps a stop condition is handed;
    // turns 1 and 2 arrive on `onTurnEnd` as each follow-up lands.
    await evaluate(meter, [step(0.02)])
    meter.recordTurn(1, { usage: { cost: 0.03 } })
    meter.recordTurn(2, { usage: { cost: 0.04 } })
    await meter.settle(loopEndingAt(0.04))

    expect(pool.spentUsd).toBeCloseTo(0.09)
  })

  it('counts the one turn of a loop that never iterated', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    // No tool calls means no follow-up, no steps, and no `onTurnEnd` — the
    // final response the loop settles on *is* that initial turn.
    await meter.settle(loopEndingAt(0.02))

    expect(pool.spentUsd).toBeCloseTo(0.02)
  })

  it('does not count the initial turn twice when the loop did iterate', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    await evaluate(meter, [step(0.02)])
    meter.recordTurn(1, { usage: { cost: 0.03 } })
    await meter.settle(loopEndingAt(0.03))

    expect(pool.spentUsd).toBeCloseTo(0.05)
  })

  it('reports the initial turn to the observer as turn 0', async () => {
    const turns: number[] = []
    const meter = meterLoop(createPool(), BUDGET, MAX_STEPS, (turn) =>
      turns.push(turn),
    )

    await evaluate(meter, [step(0.02)])
    meter.recordTurn(1, { usage: { cost: 0.03 } })

    expect(turns).toEqual([0, 1])
  })

  it('treats a turn of unknown cost as free rather than throwing', async () => {
    const pool = createPool()
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    await evaluate(meter, [step(0.02)])
    meter.recordTurn(1, {})

    expect(pool.spentUsd).toBeCloseTo(0.02)
  })
})

/**
 * The initial turn has to reach the pool *before* the ceiling is read, or the
 * loop takes another turn it cannot afford. Both assertions turn on the shared
 * pool alone: this loop's own steps stay under `maxCost`, so only `budgetStop`
 * — and only if the meter ran first — can halt it.
 */
describe('metering ahead of the stop', () => {
  const SPENT_ELSEWHERE = 0.2

  it('stops once the initial turn carries the shared pool over the limit', async () => {
    const pool = spent(SPENT_ELSEWHERE)
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    // 0.15 is under this loop's own `maxCost` ceiling of 0.30, but it takes the
    // shared pool to 0.35 — over the hard limit.
    await expect(
      isStopConditionMet({
        stopConditions: meter.stopWhen,
        steps: [step(0.15)],
      }),
    ).resolves.toBe(true)
  })

  it('lets a loop continue when that turn leaves room', async () => {
    const pool = spent(SPENT_ELSEWHERE)
    const meter = meterLoop(pool, BUDGET, MAX_STEPS)

    await expect(
      isStopConditionMet({
        stopConditions: meter.stopWhen,
        steps: [step(0.05)],
      }),
    ).resolves.toBe(false)
  })
})
