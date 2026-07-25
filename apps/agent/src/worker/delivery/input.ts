import { syntheticNews } from '../../fixtures/synthetic-news'
import type { BriefInput } from '../../schema'
import type { ScheduleDefinition } from '../scheduling/schedules'

/**
 * The corpus seam. A scheduled run still reads the synthetic fixture — live
 * retrieval is its own change, with its own eval — so only `edition` and `asOf`
 * come from the schedule that fired. Everything downstream already takes the
 * corpus from here, so swapping this out moves nothing else.
 */
export const buildBriefInput = (
  schedule: ScheduleDefinition,
  now: Date,
): BriefInput => ({
  edition: schedule.edition,
  asOf: now.toISOString(),
  docs: syntheticNews.docs,
})
