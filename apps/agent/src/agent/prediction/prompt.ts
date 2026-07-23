import type { ChatMessage } from '../../llm/openrouter'
import type { ResearchFindings } from '../../schema'

export const PREDICTION_SYSTEM_PROMPT = `You are the prediction agent for a daily market brief. Given the day's key stories, log exactly one short-horizon market prediction.

Rules:
- Respond with a single JSON object and nothing else. No markdown fences.
- Pick one instrument: a ticker or index symbol (max 16 characters).
- direction is up, down or flat; confidence is the probability that direction is correct (0.34 to 0.99).
- resolvesAt is an ISO 8601 time within 7 days of the stories' date.
- Every figure in the rationale must trace to the stories — do not invent numbers.
- This is a forecast logged for later scoring, not investment advice.`

function storiesBlock(findings: ResearchFindings): string {
  return findings.stories
    .map(
      (story, i) =>
        `[${i + 1}] ${story.title}\n${story.summary}\nWhy it matters: ${story.whyItMatters}\nSources: ${story.sourceIds.join(', ')}`,
    )
    .join('\n\n')
}

export function predictionMessages(findings: ResearchFindings): ChatMessage[] {
  return [
    { role: 'system', content: PREDICTION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `As of: ${findings.generatedAt}\nEdition: ${findings.edition}\n\nKey stories:\n\n${storiesBlock(findings)}\n\nProduce the prediction as a single JSON object.`,
    },
  ]
}
