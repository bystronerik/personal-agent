import { DEFAULT_MODEL } from '../../llm/models'
import { type Brief, type BriefInput, BriefSchema } from '../../schema'
import { readEnv } from '../../utils/env'
import { createPredictionTool, runPrediction } from '../prediction/agent'
import { createResearchTool, runResearch } from '../research/agent'
import { type Blackboard, createBlackboard } from '../shared/blackboard'
import { type Budget, budgetStopWhen, createPool } from '../shared/budget'
import { agentClient } from '../shared/client'
import type { AgentContext } from '../shared/run-context'
import { createSummaryTool, runSummary } from '../summary/agent'
import { ORCHESTRATOR_INSTRUCTIONS, orchestratorTask } from './prompt'

const ORCHESTRATOR_MAX_STEPS = 12

/** A cautious default; a real caller passes limits sized to the model and corpus. */
const DEFAULT_BUDGET: Budget = { softLimitUsd: 0.15, hardLimitUsd: 0.3 }

export type RunBriefOptions = {
  model?: string
  budget?: Budget
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
  const model = options.model ?? readEnv('OPENROUTER_MODEL') ?? DEFAULT_MODEL
  const budget = options.budget ?? DEFAULT_BUDGET
  const pool = createPool()
  const board = createBlackboard(input)
  const ctx: AgentContext = { model, board, pool, budget }

  const tools = [
    createResearchTool(ctx),
    createPredictionTool(ctx),
    createSummaryTool(ctx),
  ]

  const result = agentClient().callModel({
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
  // can halt it mid-pipeline) so a valid brief always assembles. Order matters —
  // predict and summarize read the findings the research step leaves on the board.
  if (!board.findings) await runResearch(ctx)
  const prediction = board.prediction ?? (await runPrediction(ctx))
  const summary = board.summary ?? (await runSummary(ctx))

  const brief = BriefSchema.parse({
    generatedAt: input.asOf,
    edition: input.edition,
    headlines: summary.headlines,
    marketSummary: summary.marketSummary,
    prediction,
  })

  return { brief, board, costUsd: pool.spentUsd }
}
