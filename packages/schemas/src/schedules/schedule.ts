import { z } from 'zod'

import { TopicSchema } from '../topics/topic'
import { EditionSchema } from './edition'

/**
 * `cron` and `timezone` are plain strings on the way out even though the write
 * side validates both: a row seeded before this contract existed must still read
 * back rather than fail serialization with a 500.
 */
export const ScheduleSchema = z
  .object({
    id: z.uuid(),
    edition: EditionSchema.meta({ id: 'Edition' }),
    cron: z.string(),
    timezone: z.string(),
    enabled: z.boolean(),
    lastRunAt: z.iso.datetime().nullable(),
    nextRunAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    topics: z.array(TopicSchema),
  })
  .meta({ id: 'Schedule' })
export type Schedule = z.infer<typeof ScheduleSchema>
