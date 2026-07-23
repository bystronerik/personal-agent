import { z } from 'zod'
import { EditionSchema, IsoDateTime } from './common'
import { StoriesSchema } from './story'

/**
 * The research agent's output: the stories worth the reader's attention, with no
 * market prose or prediction — those are the summary and prediction agents' jobs.
 */
export const ResearchFindingsSchema = z.object({
  generatedAt: IsoDateTime,
  edition: EditionSchema,
  stories: StoriesSchema,
})

export type ResearchFindings = z.infer<typeof ResearchFindingsSchema>
