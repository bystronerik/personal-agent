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

/** The slice of a turn's response the pool needs — narrow, so a test needs no SDK. */
type TurnCost = { usage?: { cost?: number | null } | null }

/** The slice of a `callModel` result `settle` needs. */
type SettleableLoop = { getResponse(): Promise<TurnCost> }

/** Per metered turn: turn index (the loop's first turn is 0), its cost, running total. */
export type TurnObserver = (
  turn: number,
  costUsd: number,
  totalUsd: number,
) => void

export type LoopMeter = {
  /** The stop-condition set every loop shares: global pool, per-loop cost, step ceiling. */
  stopWhen: StopCondition[]
  /** Wire to `callModel`'s `onTurnEnd`. */
  recordTurn(turn: number, response: TurnCost): void
  /** Await once the loop has settled, for the turn none of the above reached. */
  settle(loop: SettleableLoop): Promise<void>
}

const INITIAL_TURN = 0

/**
 * Meters one loop's turns into the shared pool, and carries the stop conditions
 * that read it. Every turn is counted exactly once, from three points, because
 * no single one of them sees a whole loop:
 *
 * - `onTurnEnd` fires only after a *follow-up* request, so it covers every turn
 *   but the loop's initial one.
 * - That initial turn reaches the `steps` a stop condition is handed — it is how
 *   the SDK's own `maxCost` sees it — but only once a follow-up has been made.
 * - A loop that never iterates has no steps at all, and there the final response
 *   *is* the initial turn, so `settle` reads it from the result.
 *
 * Wiring the pool to `onTurnEnd` alone silently drops one turn per loop.
 */
export function meterLoop(
  pool: BudgetPool,
  budget: Budget,
  maxSteps: number,
  observe?: TurnObserver,
): LoopMeter {
  let initialCounted = false

  const fold = (turn: number, costUsd: number | null | undefined): void => {
    const cost = costUsd ?? 0
    pool.record(cost)
    observe?.(turn, cost, pool.spentUsd)
  }

  /**
   * Meters rather than stops. It sits ahead of `budgetStop` so the initial turn
   * is in the pool before the ceiling is read: `isStopConditionMet` evaluates
   * the array in order, and both conditions are synchronous.
   */
  const meterInitialTurn: StopCondition = ({ steps }) => {
    const initial = steps[0]
    if (initial && !initialCounted) {
      initialCounted = true
      fold(INITIAL_TURN, initial.usage?.cost)
    }
    return false
  }

  return {
    stopWhen: [
      meterInitialTurn,
      budgetStop(pool, budget),
      maxCost(budget.hardLimitUsd),
      stepCountIs(maxSteps),
    ],
    recordTurn(turn, response) {
      fold(turn, response.usage?.cost)
    },
    async settle(loop) {
      if (initialCounted) return
      initialCounted = true
      fold(INITIAL_TURN, (await loop.getResponse()).usage?.cost)
    },
  }
}
