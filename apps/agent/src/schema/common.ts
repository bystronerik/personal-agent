import { z } from 'zod'

export { type Edition, EditionSchema } from '@personal-agent/schemas/schedules'

export const IsoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO 8601 date-time')

/** Shared by the summary draft and the assembled brief. */
export const MARKET_SUMMARY_LENGTH = { min: 50, max: 1000 } as const

export const MarketSummarySchema = z
  .string()
  .min(MARKET_SUMMARY_LENGTH.min)
  .max(MARKET_SUMMARY_LENGTH.max)
