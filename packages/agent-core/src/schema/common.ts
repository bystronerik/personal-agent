import { z } from 'zod'

export const IsoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO 8601 date-time')

export const EditionSchema = z.enum(['morning', 'evening'])

/** Shared by the summary draft and the assembled brief. */
export const MarketSummarySchema = z.string().min(50).max(1000)

export type Edition = z.infer<typeof EditionSchema>
