import { z } from 'zod'

import { CronExpressionSchema } from './cron'
import { EditionSchema } from './edition'
import { TimeZoneSchema } from './timezone'

/** Topics are edited through their own routes, so they are not patchable here. */
export const UpdateScheduleSchema = z
  .object({
    cron: CronExpressionSchema,
    timezone: TimeZoneSchema,
    edition: EditionSchema,
    enabled: z.boolean(),
  })
  .partial()
  .meta({ id: 'UpdateSchedule' })
export type UpdateSchedule = z.infer<typeof UpdateScheduleSchema>
