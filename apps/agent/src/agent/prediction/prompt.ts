import type { ResearchFindings } from '../../schema'
import { BOUNDS } from '../prompts/bounds'
import { briefContext } from '../prompts/stories'

export const PREDICTION_INSTRUCTIONS = `You are the prediction agent for a daily market brief. Given the day's key stories, log exactly one short-horizon market prediction.

Rules:
- Respond with a single JSON object and nothing else. No markdown fences.
- Pick one instrument: a ticker or index symbol (${BOUNDS.instrument}).
- direction is up, down or flat; confidence is the probability that direction is correct (${BOUNDS.confidence}).
- resolvesAt is an ISO 8601 time within ${BOUNDS.horizon} of the stories' date.
- rationale explains the call in ${BOUNDS.rationale}; every figure in it must trace to the stories — do not invent numbers.
- This is a forecast logged for later scoring, not investment advice.`

export function predictionTask(findings: ResearchFindings): string {
  return `${briefContext(findings)}\n\nProduce the prediction as a single JSON object.`
}
