import { createBlackboard } from '../agent/shared/blackboard'
import { type Budget, createPool } from '../agent/shared/budget'
import type { AgentContext } from '../agent/shared/run-context'
import { evalSessionId } from '../agent/shared/session'
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
  sessionId: string,
): AgentContext => ({
  model,
  board: createBlackboard(input),
  pool: createPool(),
  budget: LAYER_BUDGET,
  client: agentClient(),
  sessionId,
})

const LAYER_WIDTH = 12
const MODEL_WIDTH = 26

/** Trials taken per layer+model, so repeated runs of one model are told apart. */
const trials = new Map<string, number>()

/**
 * Names the model in the log, per run. Evalite reports one averaged score per
 * *file*, and a thrown task surfaces as a stack naming the layer but never the
 * model — so a red suite could not be read without rerunning it. Each line
 * carries the trial number too, since `trialCount` exists precisely because
 * these failures are intermittent.
 *
 * The model goes in the message rather than being left to the `stdout |` header
 * evalite prefixes: with the suites running concurrently that header attributes
 * to the wrong eval, and sometimes carries no model at all.
 */
export const reportingPerModel =
  <TInput, TOutput>(
    layer: string,
    run: (input: TInput, model: string, sessionId: string) => Promise<TOutput>,
  ) =>
  async (input: TInput, model: string): Promise<TOutput> => {
    const key = `${layer}/${model}`
    const trial = (trials.get(key) ?? 0) + 1
    trials.set(key, trial)
    const sessionId = evalSessionId(layer, trial)
    const label = `${layer.padEnd(LAYER_WIDTH)} ${model.padEnd(MODEL_WIDTH)} #${trial}  ${sessionId}`

    try {
      const output = await run(input, model, sessionId)
      console.info(`  PASS  ${label}`)
      return output
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.info(`  FAIL  ${label}  ${reason}`)
      throw error
    }
  }
