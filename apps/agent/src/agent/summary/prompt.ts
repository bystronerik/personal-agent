import type { Prediction, ResearchFindings } from '../../schema'
import { BOUNDS } from '../prompts/bounds'
import { briefContext } from '../prompts/stories'

export const SUMMARY_INSTRUCTIONS = `You are the summary agent for a daily market brief. Given the day's key stories and the logged market prediction, write the reader-facing brief body.

Rules:
- Respond with a single JSON object and nothing else. No markdown fences.
- headlines: ${BOUNDS.stories} items, each with title, summary, whyItMatters and sourceIds drawn from the stories.
- marketSummary: one concise paragraph (${BOUNDS.marketSummary}) tying the day together, consistent with the prediction.
- Every figure must trace to the stories. Do not invent numbers, and do not restate the prediction's fields as new facts.`

export function summaryTask(
  findings: ResearchFindings,
  prediction: Prediction,
): string {
  const predictionLine = `${prediction.instrument} ${prediction.direction} @ ${prediction.confidence} — ${prediction.rationale}`
  return `${briefContext(findings)}\n\nLogged prediction (for consistency, do not restate as fact):\n${predictionLine}\n\nProduce the brief body as a single JSON object.`
}
