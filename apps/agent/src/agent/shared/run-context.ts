import type { LoopClient } from '../../llm/client'
import type { SourceProvider } from '../../sources/provider'
import type { Blackboard } from './blackboard'
import { type Budget, type BudgetPool, softExceeded } from './budget'

/** Everything a specialist needs at runtime, as one argument to every `run`. */
export type AgentContext = {
  model: string
  board: Blackboard
  pool: BudgetPool
  budget: Budget
  /** Carried rather than reached for, so a loop can be driven without a key. */
  client: LoopClient
  /**
   * Where research reads from. **Required and never defaulted**, for the same
   * reason as `sessionId`: a default would let a new agent path quietly reach
   * the wrong corpus — or reach Postgres from an eval that must stay offline —
   * with no compile error to catch it.
   */
  sources: SourceProvider
  /** Sent on every `callModel` request in the run; OpenRouter groups by it. */
  sessionId: string
}

export const FINALIZE_NOTICE =
  'Budget nearly spent — do not research further; call the summary now.'

/**
 * Attaches a finalize notice to a tool's digest once the soft budget is crossed,
 * so the orchestrator reads the nudge as part of that tool's result.
 */
export function withBudgetNotice<T extends Record<string, unknown>>(
  base: T,
  ctx: AgentContext,
): T | (T & { notice: string }) {
  return softExceeded(ctx.pool, ctx.budget)
    ? { ...base, notice: FINALIZE_NOTICE }
    : base
}
