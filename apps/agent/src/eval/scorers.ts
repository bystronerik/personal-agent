import { createScorer } from 'evalite'

import {
  BRIEF_CHECKS,
  type NamedCheck,
  PREDICTION_CHECKS,
  RESEARCH_CHECKS,
  SUMMARY_CHECKS,
} from '../grading/checks'
import type { BriefInput } from '../schema'

/**
 * Wraps each named check as an evalite scorer over one artifact type. Details
 * surface as scorer metadata, so failures stay inspectable in the UI.
 */
function toScorers<T>(checks: NamedCheck<T>[]) {
  return checks.map((check) =>
    createScorer<BriefInput, T>({
      name: check.checkName,
      scorer: ({ input, output }) => {
        const result = check(output, input)
        return {
          score: result.score,
          metadata: result.details.length > 0 ? result.details : undefined,
        }
      },
    }),
  )
}

export const RESEARCH_SCORERS = toScorers(RESEARCH_CHECKS)
export const PREDICTION_SCORERS = toScorers(PREDICTION_CHECKS)
export const SUMMARY_SCORERS = toScorers(SUMMARY_CHECKS)
export const BRIEF_SCORERS = toScorers(BRIEF_CHECKS)
