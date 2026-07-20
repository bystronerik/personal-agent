import { createScorer } from 'evalite'
import {
  type CheckResult,
  echoesInput,
  numbersGrounded,
  predictionResolvable,
  sourceDiversity,
  sourceIdsResolve,
} from '../grading/checks'
import type { ParsedBrief } from '../prompt/parse-brief'
import type { Brief, BriefInput } from '../schema'

type Check = (brief: Brief, input: BriefInput) => CheckResult

/** Details surface as scorer metadata, so failures stay inspectable in the UI. */
function toScorer(name: string, description: string, check: Check) {
  return createScorer<BriefInput, ParsedBrief>({
    name,
    description,
    scorer: ({ input, output }) => {
      const result = check(output.brief, input)
      return {
        score: result.score,
        metadata: result.details.length > 0 ? result.details : undefined,
      }
    },
  })
}

export const SourceIdsResolve = toScorer(
  'sourceIdsResolve',
  'Every cited source id exists in the input',
  sourceIdsResolve,
)

export const NumbersGrounded = toScorer(
  'numbersGrounded',
  'Every number in the brief traces to a source figure',
  numbersGrounded,
)

export const SourceDiversity = toScorer(
  'sourceDiversity',
  'Headlines draw on distinct source documents',
  (brief) => sourceDiversity(brief),
)

export const PredictionResolvable = toScorer(
  'predictionResolvable',
  'Prediction resolves in the future within a scoreable horizon',
  (brief) => predictionResolvable(brief),
)

export const EchoesInput = toScorer(
  'echoesInput',
  'Brief echoes the supplied asOf and edition',
  echoesInput,
)

/**
 * Only meaningful against a live model — a hand-written fixture is never fenced,
 * so this is kept out of BRIEF_SCORERS and added by the model eval alone.
 */
export const UnfencedOutput = createScorer<BriefInput, ParsedBrief>({
  name: 'unfencedOutput',
  description: 'Model returned bare JSON rather than a markdown fence',
  scorer: ({ output }) => ({
    score: output.wasFenced ? 0 : 1,
    metadata: output.wasFenced
      ? ['output was wrapped in a markdown fence despite instructions']
      : undefined,
  }),
})

/** Content quality — applies equally to model output and to fixtures. */
export const BRIEF_SCORERS = [
  SourceIdsResolve,
  NumbersGrounded,
  SourceDiversity,
  PredictionResolvable,
  EchoesInput,
]
