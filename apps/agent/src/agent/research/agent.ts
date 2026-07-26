import { hasToolCall, tool } from '@openrouter/agent'
import { z } from 'zod'

import {
  type ResearchFindings,
  ResearchFindingsSchema,
  StoriesSchema,
} from '../../schema'
import { createNewsTools } from '../../tools/news'
import { BOUNDS } from '../prompts/bounds'
import { meterLoop } from '../shared/budget'
import { type AgentContext, withBudgetNotice } from '../shared/run-context'
import { researchInstructions, researchTask } from './prompt'

const RESEARCH_MAX_STEPS = 24

const RecordInput = z.object({ stories: StoriesSchema })

/**
 * The tool the research loop calls to finish: its input schema *is* the findings
 * shape, so the model's submission is SDK-validated and `hasToolCall` can end
 * the loop cleanly — no separate structured finalize call.
 */
function recordFindingsTool(ctx: AgentContext) {
  return tool({
    name: 'record_findings',
    description: `Submit the final set of ${BOUNDS.stories} stories worth the reader’s attention. Call this exactly once, when research is complete.`,
    inputSchema: RecordInput,
    execute: ({ stories }) => {
      const findings = ResearchFindingsSchema.parse({
        generatedAt: ctx.board.input.asOf,
        edition: ctx.board.input.edition,
        stories,
      })
      ctx.board.findings = findings
      return { recorded: findings.stories.length }
    },
  })
}

/** Runs the research loop and leaves the findings on the blackboard. */
export async function runResearch(
  ctx: AgentContext,
  focus?: string,
): Promise<ResearchFindings> {
  const tools = [...createNewsTools(ctx.sources), recordFindingsTool(ctx)]

  const meter = meterLoop(ctx.pool, ctx.budget, RESEARCH_MAX_STEPS)
  const result = ctx.client.callModel({
    model: ctx.model,
    sessionId: ctx.sessionId,
    instructions: researchInstructions(ctx.board.input.topics),
    input: researchTask(ctx.board.input, focus),
    tools,
    temperature: 0,
    stopWhen: [hasToolCall('record_findings'), ...meter.stopWhen],
    onTurnEnd: (turn, response) =>
      meter.recordTurn(turn.numberOfTurns, response),
  })
  await result.getText()
  await meter.settle(result)

  if (!ctx.board.findings) {
    throw new Error('research finished without recording findings')
  }
  return ctx.board.findings
}

const digestOf = (findings: ResearchFindings) => ({
  stories: findings.stories.length,
  titles: findings.stories.map((story) => story.title),
})

/** The orchestrator-facing tool: research, then report a compact digest. */
export function createResearchTool(ctx: AgentContext) {
  return tool({
    name: 'research',
    description:
      'Research the news and record the stories most relevant to the reader. Returns how many stories were found and their titles.',
    inputSchema: z.object({
      focus: z
        .string()
        .optional()
        .describe('Optional emphasis to steer what to look for.'),
    }),
    execute: async ({ focus }) => {
      const findings = await runResearch(ctx, focus)
      return withBudgetNotice(digestOf(findings), ctx)
    },
  })
}
