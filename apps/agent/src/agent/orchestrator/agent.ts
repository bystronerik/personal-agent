import { agentClient, type LoopClient } from '../../llm/client'
import { resolveModel } from '../../llm/models'
import { type Brief, type BriefInput, BriefSchema } from '../../schema'
import { createPredictionTool, runPrediction } from '../prediction/agent'
import { createResearchTool, runResearch } from '../research/agent'
import { type Blackboard, createBlackboard } from '../shared/blackboard'
import {
  type Budget,
  budgetStopWhen,
  createPool,
  finalizeBudget,
} from '../shared/budget'
import type { AgentContext } from '../shared/run-context'
import { createSummaryTool, runSummary } from '../summary/agent'
import { ORCHESTRATOR_INSTRUCTIONS, orchestratorTask } from './prompt'

const ORCHESTRATOR_MAX_STEPS = 12

/** A cautious default; a real caller passes limits sized to the model and corpus. */
const DEFAULT_BUDGET: Budget = { softLimitUsd: 0.15, hardLimitUsd: 0.3 }

export type RunBriefOptions = {
  model?: string
  budget?: Budget
  /** Defaults to the shared `@openrouter/agent` client; injectable for tests. */
  client?: LoopClient
  /** Per orchestrator turn: turn index, that turn's cost, running total. */
  onTurnEnd?: (turn: number, costUsd: number, totalUsd: number) => void
}

export type BriefRun = {
  brief: Brief
  board: Blackboard
  costUsd: number
}

/**
 * The model-driven orchestrator. It offers the three specialists as tools and
 * decides the sequence; the specialists hand off through the blackboard, and a
 * shared budget pool (fed by every loop's onTurnEnd) bounds the whole run.
 */
export async function runBrief(
  input: BriefInput,
  options: RunBriefOptions = {},
): Promise<BriefRun> {
  const model = resolveModel(options.model)
  const budget = options.budget ?? DEFAULT_BUDGET
  const pool = createPool()
  const board = createBlackboard(input)
  const ctx: AgentContext = {
    model,
    board,
    pool,
    budget,
    client: options.client ?? agentClient(),
  }

  const tools = [
    createResearchTool(ctx),
    createPredictionTool(ctx),
    createSummaryTool(ctx),
  ]

  const result = ctx.client.callModel({
    model,
    instructions: ORCHESTRATOR_INSTRUCTIONS,
    input: orchestratorTask(input),
    tools,
    temperature: 0,
    stopWhen: budgetStopWhen(pool, budget, ORCHESTRATOR_MAX_STEPS),
    onTurnEnd: (turn, response) => {
      const cost = response.usage?.cost ?? 0
      pool.record(cost)
      options.onTurnEnd?.(turn.numberOfTurns, cost, pool.spentUsd)
    },
  })
  await result.getText()

  // Guaranteed finalize: fill whatever the loop left unfinished (a budget stop
  // can halt it mid-pipeline) so a valid brief always assembles. It runs on a
  // reserve ceiling — the stop that halted the loop closes over the shared pool,
  // so on the original budget the finalize research would be stopped before its
  // first turn. Order matters: predict and summarize read the findings research
  // leaves on the board.
  const finalizeCtx: AgentContext = {
    ...ctx,
    budget: finalizeBudget(pool, budget),
  }
  if (!board.findings) await runResearch(finalizeCtx)
  const prediction = board.prediction ?? (await runPrediction(finalizeCtx))
  const summary = board.summary ?? (await runSummary(finalizeCtx))

  const brief = BriefSchema.parse({
    generatedAt: input.asOf,
    edition: input.edition,
    headlines: summary.headlines,
    marketSummary: summary.marketSummary,
    prediction,
  })

  return { brief, board, costUsd: pool.spentUsd }
}
