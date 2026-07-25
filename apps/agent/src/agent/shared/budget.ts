import { maxCost, type StopCondition, stepCountIs } from '@openrouter/agent'

export type Budget = {
  softLimitUsd: number
  hardLimitUsd: number
  /** Headroom held back for the finalize path; defaults to half the hard limit. */
  reserveUsd?: number
}

/** A cautious default; a real caller passes limits sized to the model and corpus. */
export const DEFAULT_BUDGET: Budget = { softLimitUsd: 0.15, hardLimitUsd: 0.3 }

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

const DEFAULT_RESERVE_FRACTION = 0.5

/**
 * The budget the orchestrator's finalize path runs under. Every loop stops on
 * the *shared* pool, so once the hard limit is reached a nested loop is already
 * stopped before its first turn — including the finalize research a brief
 * cannot assemble without. Lifting the ceiling to what has been spent plus a
 * reserve gives that path room the loop cannot have consumed, while the pool
 * keeps one honest total for the run.
 */
export function finalizeBudget(pool: BudgetPool, budget: Budget): Budget {
  const reserve =
    budget.reserveUsd ?? budget.hardLimitUsd * DEFAULT_RESERVE_FRACTION
  return {
    ...budget,
    hardLimitUsd: Math.max(budget.hardLimitUsd, pool.spentUsd + reserve),
  }
}

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
