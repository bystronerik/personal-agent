import { agentDb } from '../../db'
import type { BriefInput } from '../../schema'
import type { ScheduleDefinition } from '../scheduling/schedules'

/**
 * The corpus seam. A scheduled run carries **no `docs`** — the documents live in
 * Postgres and the model chooses them through `search_news`, rather than being
 * handed the corpus up front. What comes from the schedule is the edition, the
 * moment, and the reader's topics.
 *
 * Topics are one query on a key this function already holds. An empty list is
 * not an error: it asks for a general brief.
 */
export async function buildBriefInput(
  schedule: ScheduleDefinition,
  now: Date,
): Promise<BriefInput> {
  const topics = await agentDb().topic.findMany({
    where: { scheduleId: schedule.id },
    orderBy: { createdAt: 'asc' },
    select: { subject: true },
  })

  return {
    edition: schedule.edition,
    asOf: now.toISOString(),
    topics: topics.map((topic) => topic.subject),
  }
}
