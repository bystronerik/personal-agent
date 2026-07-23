import { z } from 'zod'

export const TopicSchema = z
  .object({
    id: z.uuid(),
    subject: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Topic' })
export type Topic = z.infer<typeof TopicSchema>
