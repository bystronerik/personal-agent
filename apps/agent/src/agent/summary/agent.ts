import { tool } from '@openrouter/agent'
import { z } from 'zod'

import type { ResponseSchema } from '../../llm/decode'
import { type SummaryDraft, SummaryDraftSchema } from '../../schema'
import { type AgentContext, withBudgetNotice } from '../shared/run-context'
import { structuredComplete } from '../shared/structured'
import { summaryMessages } from './prompt'

const SUMMARY_SCHEMA: ResponseSchema<SummaryDraft> = {
  name: 'summary',
  schema: SummaryDraftSchema,
}

/** One structured call: findings + prediction in, the brief body out and onto the board. */
export async function runSummary(ctx: AgentContext): Promise<SummaryDraft> {
  const { findings, prediction } = ctx.board
  if (!findings) throw new Error('summary requires research findings')
  if (!prediction) throw new Error('summary requires a prediction')

  const result = await structuredComplete({
    model: ctx.model,
    messages: summaryMessages(findings, prediction),
    responseSchema: SUMMARY_SCHEMA,
    temperature: 0,
  })
  ctx.pool.record(result.costUsd)
  ctx.board.summary = result.value
  return result.value
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
