import { tool } from '@openrouter/agent'
import { z } from 'zod'

import type { ResponseSchema } from '../../llm/decode'
import { type SummaryDraft, SummaryDraftSchema } from '../../schema'
import { type AgentContext, withBudgetNotice } from '../shared/run-context'
import { structuredComplete } from '../shared/structured'
import { SUMMARY_INSTRUCTIONS, summaryTask } from './prompt'

const SUMMARY_SCHEMA: ResponseSchema<SummaryDraft> = {
  name: 'summary',
  schema: SummaryDraftSchema,
}

/** One structured call: findings + prediction in, the brief body out and onto the board. */
export async function runSummary(ctx: AgentContext): Promise<SummaryDraft> {
  const { findings, prediction } = ctx.board
  if (!findings) throw new Error('summary requires research findings')
  if (!prediction) throw new Error('summary requires a prediction')

  const summary = await structuredComplete(ctx, {
    instructions: SUMMARY_INSTRUCTIONS,
    input: summaryTask(findings, prediction),
    responseSchema: SUMMARY_SCHEMA,
  })
  ctx.board.summary = summary
  return summary
}

export function createSummaryTool(ctx: AgentContext) {
  return tool({
    name: 'summarize',
    description:
      'Write the brief body (headlines and market summary) from the findings and prediction. Requires both to exist first. This is the final step.',
    inputSchema: z.object({}),
    execute: async () => {
      const { headlines } = await runSummary(ctx)
      return withBudgetNotice({ headlines: headlines.length, ready: true }, ctx)
    },
  })
}
