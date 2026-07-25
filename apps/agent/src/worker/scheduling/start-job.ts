import { Cron } from 'croner'

import type { ScheduleJob } from './registry'
import type { ScheduleDefinition } from './schedules'

export type JobHandler = (definition: ScheduleDefinition) => Promise<void>

/**
 * One live croner job per enabled schedule. Two of its options replace logic
 * that would otherwise be ours: `timezone` (DST-correct firing) and `catch` (an
 * unexpected throw logs instead of taking the worker down). Overlap protection
 * is deliberately *not* among them — `protect` sees only this job, and the
 * catch-up pass fires the same schedule from outside it, so the worker keeps a
 * single per-schedule guard of its own in `run-occurrence.ts`.
 */
export function startJob(
  definition: ScheduleDefinition,
  handle: JobHandler,
): ScheduleJob {
  return new Cron(
    definition.cron,
    {
      name: definition.id,
      timezone: definition.timezone,
      catch: (error: unknown) =>
        console.error(
          `[${definition.id}] job failed:`,
          error instanceof Error ? error.message : error,
        ),
    },
    () => handle(definition),
  )
}
