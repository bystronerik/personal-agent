import { z } from 'zod'

import { IsoDateTime } from './common'

export const DirectionSchema = z.enum(['up', 'down', 'flat'])

/** Ticker or index symbol, e.g. "SPX". */
export const INSTRUMENT_LENGTH = { min: 1, max: 16 } as const

/**
 * Probability the stated direction is correct. Floor 0.34: below that on a
 * three-way call, a different direction should have been picked. Ceiling 0.99:
 * keeps log-loss finite if the scoring rule changes.
 */
export const CONFIDENCE = { min: 0.34, max: 0.99 } as const

/**
 * The window a logged prediction must resolve within. The schema cannot enforce
 * it — `resolvesAt` has no reference date to measure from here — so this is the
 * single value the prompt states and `grading/checks.ts` scores against.
 */
export const MAX_HORIZON_DAYS = 7

/** Enough to tie the call to the stories it came from, and no further. */
export const RATIONALE_LENGTH = { min: 20, max: 600 } as const

export const PredictionSchema = z.object({
  instrument: z.string().min(INSTRUMENT_LENGTH.min).max(INSTRUMENT_LENGTH.max),
  direction: DirectionSchema,
  confidence: z.number().min(CONFIDENCE.min).max(CONFIDENCE.max),
  resolvesAt: IsoDateTime,
  rationale: z.string().min(RATIONALE_LENGTH.min).max(RATIONALE_LENGTH.max),
})

export type Direction = z.infer<typeof DirectionSchema>
export type Prediction = z.infer<typeof PredictionSchema>
