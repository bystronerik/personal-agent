import { type SummaryDraft, SummaryDraftSchema } from '../schema'
import { referenceBrief } from './brief-good'

/** The reference brief's body: headlines and market summary, no prediction. */
export const referenceSummary: SummaryDraft = SummaryDraftSchema.parse({
  headlines: referenceBrief.headlines,
  marketSummary: referenceBrief.marketSummary,
})
