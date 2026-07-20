import type { Blackboard } from './blackboard'
import { type Budget, type BudgetPool, softExceeded } from './budget'

/**
 * Everything a specialist needs at runtime: the model to call, the shared
 * hand-off store, and the shared budget. Passing one context keeps every
 * agent's `run` signature uniform and per-layer-testable.
 */
export type AgentContext = {
  model: string
  board: Blackboard
  pool: BudgetPool
  budget: Budget
}

export const FINALIZE_NOTICE =
  'Budget nearly spent — do not research further; call the summary now.'

/**
 * Attaches a finalize notice to a tool's compact digest once the soft budget is
 * crossed. The orchestrator reads tool results, so the nudge arrives as data
 * rather than a mid-loop message injection.
 */
export function withBudgetNotice<T extends Record<string, unknown>>(
  base: T,
  ctx: AgentContext,
): T | (T & { notice: string }) {
  return softExceeded(ctx.pool, ctx.budget)
    ? { ...base, notice: FINALIZE_NOTICE }
    : base
}
