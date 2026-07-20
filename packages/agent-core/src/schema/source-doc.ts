import { z } from 'zod'
import { IsoDateTime } from './common'

export const SourceDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  publishedAt: IsoDateTime,
})

export type SourceDoc = z.infer<typeof SourceDocSchema>
