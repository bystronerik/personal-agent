import { Cron } from 'croner'

import type { ScheduleDefinition } from './schedules'

/** Paused: built only to read occurrences off the pattern, never to fire. */
const patternOf = (definition: ScheduleDefinition): Cron =>
  new Cron(definition.cron, {
    timezone: definition.timezone,
    paused: true,
  })

const readOccurrence = (
  definition: ScheduleDefinition,
  read: (job: Cron) => Date | null,
): Date | null => {
  const job = patternOf(definition)
  try {
    return read(job)
  } finally {
    job.stop()
  }
}

/**
 * croner's `previousRuns` searches back from a whole second *before* the moment
 * it is given, so an occurrence in the same second as `from` would be reported
 * as the one before it — a worker booting at 07:00:00 would read yesterday's
 * 07:00 and never catch up on today's.
 */
const CRONER_LOOKBACK_MS = 1000

/** The most recent occurrence at or before `from`, for the catch-up check. */
export const previousOccurrence = (
  definition: ScheduleDefinition,
  from: Date,
): Date | null =>
  readOccurrence(
    definition,
    (job) =>
      job.previousRuns(1, new Date(from.getTime() + CRONER_LOOKBACK_MS))[0] ??
      null,
  )
