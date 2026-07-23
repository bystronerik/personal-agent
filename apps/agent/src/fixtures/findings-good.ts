import { type ResearchFindings, ResearchFindingsSchema } from '../schema'
import { referenceBrief } from './brief-good'

/**
 * The research view of the reference brief: its stories, before market prose and
 * the prediction. Derived from [brief-good](./brief-good.ts) so the two never drift.
 */
export const referenceFindings: ResearchFindings = ResearchFindingsSchema.parse(
  {
    generatedAt: referenceBrief.generatedAt,
    edition: referenceBrief.edition,
    stories: referenceBrief.headlines,
  },
)
