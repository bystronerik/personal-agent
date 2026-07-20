import { type SummaryDraft, SummaryDraftSchema } from '../schema'
import { hallucinatedBrief } from './brief-hallucinated'

/**
 * The defective brief body — invented market figures and single-source
 * headlines trip numbersGrounded and sourceDiversity.
 */
export const hallucinatedSummary: SummaryDraft = SummaryDraftSchema.parse({
  headlines: hallucinatedBrief.headlines,
  marketSummary: hallucinatedBrief.marketSummary,
})
