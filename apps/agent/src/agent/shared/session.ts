import { randomBytes } from 'node:crypto'

import type { BriefInput } from '../../schema'

/** OpenRouter's cap on `session_id`. */
const MAX_LENGTH = 256

/**
 * The suffix is what makes an id unique; the descriptive parts are there to be
 * read. So truncating to the cap drops description and never the suffix.
 */
const sessionId = (parts: string[], suffixBytes: number): string => {
  const suffix = randomBytes(suffixBytes).toString('hex')
  const label = parts
    .map((part) => part.replace(/[^a-zA-Z0-9]+/g, '-'))
    .join('-')
    .slice(0, MAX_LENGTH - suffix.length - 1)
  return `${label}-${suffix}`
}

const BRIEF_SUFFIX_BYTES = 3

export const briefSessionId = ({
  edition,
  asOf,
}: Pick<BriefInput, 'edition' | 'asOf'>): string =>
  sessionId(['brief', edition, asOf], BRIEF_SUFFIX_BYTES)

/** Longer: entropy is all that separates one model's run from another's here. */
const EVAL_SUFFIX_BYTES = 6

export const evalSessionId = (layer: string, trial: number): string =>
  sessionId(['eval', layer, `t${trial}`], EVAL_SUFFIX_BYTES)
