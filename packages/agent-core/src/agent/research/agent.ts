import { hasToolCall, tool } from '@openrouter/agent'
import { z } from 'zod'
import {
  type ResearchFindings,
  ResearchFindingsSchema,
  StoriesSchema,
} from '../../schema'
import { createNewsTools } from '../../tools/news'
import { budgetStopWhen } from '../shared/budget'
import { agentClient } from '../shared/client'
import { type AgentContext, withBudgetNotice } from '../shared/run-context'
import { RESEARCH_INSTRUCTIONS, researchTask } from './prompt'

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
    description:
      'Submit the final set of 3–7 stories worth the reader’s attention. Call this exactly once, when research is complete.',
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
  const tools = [
    ...createNewsTools(ctx.board.input.docs),
    recordFindingsTool(ctx),
  ]

  const result = agentClient().callModel({
    model: ctx.model,
    instructions: RESEARCH_INSTRUCTIONS,
    input: researchTask(ctx.board.input, focus),
    tools,
    temperature: 0,
    stopWhen: [
      hasToolCall('record_findings'),
      ...budgetStopWhen(ctx.pool, ctx.budget, RESEARCH_MAX_STEPS),
    ],
    onTurnEnd: (_turn, response) => ctx.pool.record(response.usage?.cost),
  })
  await result.getText()

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
