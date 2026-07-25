import { z } from 'zod'

import { EditionSchema, IsoDateTime } from './common'
import { SourceDocSchema } from './source-doc'

export const BriefInputSchema = z.object({
  edition: EditionSchema,
  asOf: IsoDateTime,
  docs: z.array(SourceDocSchema).min(1),
})

export type BriefInput = z.infer<typeof BriefInputSchema>
