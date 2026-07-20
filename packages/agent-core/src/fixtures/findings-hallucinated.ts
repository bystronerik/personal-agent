import { type ResearchFindings, ResearchFindingsSchema } from '../schema'
import { hallucinatedBrief } from './brief-hallucinated'

/**
 * The research view of the defective brief — trips the research checks
 * (unknown source id, invented figures, single-source stories, wrong edition).
 * Derived from [brief-hallucinated](./brief-hallucinated.ts), where each defect
 * is annotated with the check it fails.
 */
export const hallucinatedFindings: ResearchFindings =
  ResearchFindingsSchema.parse({
    generatedAt: hallucinatedBrief.generatedAt,
    edition: hallucinatedBrief.edition,
    stories: hallucinatedBrief.headlines,
  })
