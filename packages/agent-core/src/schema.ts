import { z } from 'zod'

const IsoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO 8601 date-time')

export const SourceDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  publishedAt: IsoDateTime,
})

export const BriefInputSchema = z.object({
  edition: z.enum(['morning', 'evening']),
  asOf: IsoDateTime,
  docs: z.array(SourceDocSchema).min(1),
})

export const StorySchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(40).max(600),
  whyItMatters: z.string().min(20).max(400),
  sourceIds: z.array(z.string().min(1)).min(1),
})

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

export const BriefSchema = z.object({
  generatedAt: IsoDateTime,
  edition: z.enum(['morning', 'evening']),
  headlines: z.array(StorySchema).min(3).max(7),
  marketSummary: z.string().min(50).max(1000),
  prediction: PredictionSchema,
})

export type SourceDoc = z.infer<typeof SourceDocSchema>
export type BriefInput = z.infer<typeof BriefInputSchema>
export type Story = z.infer<typeof StorySchema>
export type Direction = z.infer<typeof DirectionSchema>
export type Prediction = z.infer<typeof PredictionSchema>
export type Brief = z.infer<typeof BriefSchema>
