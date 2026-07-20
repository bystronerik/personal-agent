import type { ChatMessage } from '../../llm/openrouter'
import type { Prediction, ResearchFindings } from '../../schema'

export const SUMMARY_SYSTEM_PROMPT = `You are the summary agent for a daily market brief. Given the day's key stories and the logged market prediction, write the reader-facing brief body.

Rules:
- Respond with a single JSON object and nothing else. No markdown fences.
- headlines: 3 to 7 items, each with title, summary, whyItMatters and sourceIds drawn from the stories.
- marketSummary: one concise paragraph (50 to 1000 characters) tying the day together, consistent with the prediction.
- Every figure must trace to the stories. Do not invent numbers, and do not restate the prediction's fields as new facts.`

function storiesBlock(findings: ResearchFindings): string {
  return findings.stories
    .map(
      (story, i) =>
        `[${i + 1}] ${story.title}\n${story.summary}\nWhy it matters: ${story.whyItMatters}\nSources: ${story.sourceIds.join(', ')}`,
    )
    .join('\n\n')
}

export function summaryMessages(
  findings: ResearchFindings,
  prediction: Prediction,
): ChatMessage[] {
  const predictionLine = `${prediction.instrument} ${prediction.direction} @ ${prediction.confidence} — ${prediction.rationale}`
  return [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `As of: ${findings.generatedAt}\nEdition: ${findings.edition}\n\nKey stories:\n\n${storiesBlock(findings)}\n\nLogged prediction (for consistency, do not restate as fact):\n${predictionLine}\n\nProduce the brief body as a single JSON object.`,
    },
  ]
}
