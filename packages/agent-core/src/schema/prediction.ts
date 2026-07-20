import { z } from 'zod'
import { IsoDateTime } from './common'

export const DirectionSchema = z.enum(['up', 'down', 'flat'])

export const PredictionSchema = z.object({
  /** Ticker or index symbol, e.g. "SPX". */
  instrument: z.string().min(1).max(16),
  direction: DirectionSchema,
  /**
   * Probability the stated direction is correct. Floor 0.34: below that on a
   * three-way call, a different direction should have been picked. Ceiling
   * 0.99: keeps log-loss finite if the scoring rule changes.
   */
  confidence: z.number().min(0.34).max(0.99),
  resolvesAt: IsoDateTime,
  rationale: z.string().min(20).max(600),
})

export type Direction = z.infer<typeof DirectionSchema>
export type Prediction = z.infer<typeof PredictionSchema>
