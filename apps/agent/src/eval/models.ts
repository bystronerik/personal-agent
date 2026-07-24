import { createBlackboard } from '../agent/shared/blackboard'
import { type Budget, createPool } from '../agent/shared/budget'
import type { AgentContext } from '../agent/shared/run-context'
import { agentClient } from '../llm/client'
import { COMPARED_MODELS } from '../llm/models'
import type { BriefInput } from '../schema'

/** The fan-out every `*.model.eval.ts` shares; evalite names each run by model id. */
export const acrossModels = () =>
  COMPARED_MODELS.map((model) => ({ name: model, input: model }))

/** Generous — a layer eval measures that layer's output, not budget behaviour. */
export const LAYER_BUDGET: Budget = { softLimitUsd: 1, hardLimitUsd: 2 }

/** Generous enough to let the orchestrator finish the whole pipeline once. */
export const E2E_BUDGET: Budget = { softLimitUsd: 1.5, hardLimitUsd: 3 }

/** A fresh context per run: its own pool and board, the real client. */
export const layerContext = (
  input: BriefInput,
  model: string,
): AgentContext => ({
  model,
  board: createBlackboard(input),
  pool: createPool(),
  budget: LAYER_BUDGET,
  client: agentClient(),
})
