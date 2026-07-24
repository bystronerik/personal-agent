import {
  CONFIDENCE,
  INSTRUMENT_LENGTH,
  MARKET_SUMMARY_LENGTH,
  MAX_HORIZON_DAYS,
  STORY_COUNT,
} from '../../schema'

/**
 * The bound fragments the prompts interpolate, rendered from the same constants
 * the Zod schemas are built from. `llm/json-schema.ts` strips bound keywords off
 * the wire schema, so this prose is the *only* channel that tells a model what a
 * bound is — Zod then rejects a violation after the fact, as a thrown decode
 * error rather than a retry. Deriving the wording here is what keeps the two
 * from drifting apart silently.
 */
export const BOUNDS = {
  stories: `${STORY_COUNT.min} to ${STORY_COUNT.max}`,
  confidence: `${CONFIDENCE.min} to ${CONFIDENCE.max}`,
  marketSummary: `${MARKET_SUMMARY_LENGTH.min} to ${MARKET_SUMMARY_LENGTH.max} characters`,
  instrument: `max ${INSTRUMENT_LENGTH.max} characters`,
  horizon: `${MAX_HORIZON_DAYS} days`,
} as const
