import { maxCost, type StopCondition, stepCountIs } from '@openrouter/agent'

export type Budget = {
  softLimitUsd: number
  hardLimitUsd: number
}

/**
 * A running USD tally shared by every model turn in one brief — the
 * orchestrator's turns and the nested research loop's turns fold into the same
 * pool, so the ceiling bounds the whole run rather than any single loop.
 */
export type BudgetPool = {
  spentUsd: number
  /** Fold one turn's cost in; wire to `callModel`'s `onTurnEnd`. */
  record(costUsd: number | null | undefined): void
}

export function createPool(): BudgetPool {
  const pool: BudgetPool = {
    spentUsd: 0,
    record(costUsd) {
      pool.spentUsd += costUsd ?? 0
    },
  }
  return pool
}

/** True once the soft threshold is crossed — specialist tools attach a finalize notice. */
export const softExceeded = (pool: BudgetPool, budget: Budget): boolean =>
  pool.spentUsd >= budget.softLimitUsd

/**
 * Stops a loop once the shared pool reaches the hard limit. Paired with the
 * SDK's own `maxCost`/`stepCountIs` as backstops: `maxCost` only sees the
 * current loop's turns, while this sees the global total including nested research.
 */
export const budgetStop =
  (pool: BudgetPool, budget: Budget): StopCondition =>
  () =>
    pool.spentUsd >= budget.hardLimitUsd

/** The stop-condition set every loop shares: global pool, per-loop cost, step ceiling. */
export const budgetStopWhen = (
  pool: BudgetPool,
  budget: Budget,
  maxSteps: number,
): StopCondition[] => [
  budgetStop(pool, budget),
  maxCost(budget.hardLimitUsd),
  stepCountIs(maxSteps),
]
