import { z } from 'zod'

import { EditionSchema, IsoDateTime } from './common'

export const BriefInputSchema = z.object({
  edition: EditionSchema,
  asOf: IsoDateTime,
  /**
   * The reader's standing interests, from the firing schedule's topic rows. An
   * empty list is meaningful: it asks for a general brief, not for nothing.
   */
  topics: z.array(z.string().min(1)).default([]),
})

export type BriefInput = z.infer<typeof BriefInputSchema>
