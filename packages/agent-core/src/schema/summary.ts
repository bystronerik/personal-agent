import { z } from 'zod'
import { MarketSummarySchema } from './common'
import { StoriesSchema } from './story'

/**
 * The summary agent's output: the prose parts of the brief. The prediction is
 * slotted in from the prediction agent when the final brief is assembled, so the
 * summary model never re-serializes it.
 */
export const SummaryDraftSchema = z.object({
  headlines: StoriesSchema,
  marketSummary: MarketSummarySchema,
})

export type SummaryDraft = z.infer<typeof SummaryDraftSchema>
