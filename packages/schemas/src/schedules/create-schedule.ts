import { z } from 'zod'

import { TopicSubjectSchema } from '../topics/create-topic'
import { CronExpressionSchema } from './cron'
import { EditionSchema } from './edition'
import { MAX_TOPICS_PER_SCHEDULE } from './limits'
import { TimeZoneSchema } from './timezone'

export const CreateScheduleSchema = z
  .object({
    cron: CronExpressionSchema,
    timezone: TimeZoneSchema,
    edition: EditionSchema,
    enabled: z.boolean().default(true),
    topics: z.array(TopicSubjectSchema).max(MAX_TOPICS_PER_SCHEDULE).optional(),
  })
  .meta({ id: 'CreateSchedule' })
export type CreateSchedule = z.infer<typeof CreateScheduleSchema>
