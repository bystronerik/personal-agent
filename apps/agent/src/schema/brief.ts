import { z } from 'zod'

import { EditionSchema, IsoDateTime, MarketSummarySchema } from './common'
import { PredictionSchema } from './prediction'
import { StoriesSchema } from './story'

/**
 * The assembled final artifact: the summary draft plus the echoed input fields
 * and the authoritative prediction. This is what the orchestrator returns and
 * what the end-to-end checks score.
 */
export const BriefSchema = z.object({
  generatedAt: IsoDateTime,
  edition: EditionSchema,
  headlines: StoriesSchema,
  marketSummary: MarketSummarySchema,
  prediction: PredictionSchema,
})

export type Brief = z.infer<typeof BriefSchema>
