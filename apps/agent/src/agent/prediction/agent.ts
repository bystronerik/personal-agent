import { tool } from '@openrouter/agent'
import { z } from 'zod'

import type { ResponseSchema } from '../../llm/decode'
import { type Prediction, PredictionSchema } from '../../schema'
import { type AgentContext, withBudgetNotice } from '../shared/run-context'
import { structuredComplete } from '../shared/structured'
import { PREDICTION_INSTRUCTIONS, predictionTask } from './prompt'

const PREDICTION_SCHEMA: ResponseSchema<Prediction> = {
  name: 'prediction',
  schema: PredictionSchema,
}

/** One structured call: findings in, a single prediction out and onto the board. */
export async function runPrediction(ctx: AgentContext): Promise<Prediction> {
  const { findings } = ctx.board
  if (!findings) throw new Error('prediction requires research findings')

  const prediction = await structuredComplete(ctx, {
    instructions: PREDICTION_INSTRUCTIONS,
    input: predictionTask(findings),
    responseSchema: PREDICTION_SCHEMA,
  })
  ctx.board.prediction = prediction
  return prediction
}

export function createPredictionTool(ctx: AgentContext) {
  return tool({
    name: 'predict',
    description:
      'Make one market prediction from the recorded research findings. Requires research to have run first.',
    inputSchema: z.object({}),
    execute: async () => {
      const { instrument, direction, confidence } = await runPrediction(ctx)
      return withBudgetNotice({ instrument, direction, confidence }, ctx)
    },
  })
}
