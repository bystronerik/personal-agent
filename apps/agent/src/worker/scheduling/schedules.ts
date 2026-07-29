import { z } from 'zod'

import { agentDb } from '../../db'
import { type Edition, EditionSchema } from '../../schema'
import { isCronExpression, isTimeZone } from './pattern-checks'

/**
 * A schedule row that has been checked well enough to build a job from. The
 * `edition` column is a plain string in Postgres, so this parse is the only
 * thing standing between a typo in a hand-seeded row and a run that cannot
 * assemble a brief.
 */
const ScheduleRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  cron: z.string().refine(isCronExpression, 'is not a valid cron expression'),
  timezone: z.string().refine(isTimeZone, 'is not a valid IANA time zone'),
  edition: EditionSchema,
  lastRunAt: z.date().nullable(),
  createdAt: z.date(),
})

export type ScheduleDefinition = {
  id: string
  /** Who the brief is addressed to — the delivery channel is a column on them. */
  userId: string
  cron: string
  timezone: string
  edition: Edition
  lastRunAt: Date | null
  /** The floor for catch-up: an occurrence older than the row was never missed. */
  createdAt: Date
}

const describe = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '(row)'} ${issue.message}`)
    .join('; ')

/**
 * What each bad row was last reported as. The parse re-runs every reconcile
 * pass, so without this one typo would write the same line every half minute and
 * bury the lines that mean something.
 */
let reported = new Map<string, string>()

/**
 * One unusable row must not cost every other schedule its briefs, so a bad row
 * is reported and dropped rather than thrown. It reappears on the next reconcile
 * pass, so fixing the row is enough — no restart.
 */
export async function listEnabledSchedules(): Promise<ScheduleDefinition[]> {
  const rows = await agentDb().schedule.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'asc' },
  })

  const definitions: ScheduleDefinition[] = []
  const problems = new Map<string, string>()
  for (const row of rows) {
    const parsed = ScheduleRowSchema.safeParse(row)
    if (parsed.success) {
      definitions.push(parsed.data)
      continue
    }
    const problem = describe(parsed.error)
    problems.set(row.id, problem)
    if (reported.get(row.id) !== problem) {
      console.error(`Ignoring schedule ${row.id}: ${problem}`)
    }
  }
  reported = problems
  return definitions
}

export async function findSchedule(
  id: string,
): Promise<ScheduleDefinition | undefined> {
  const schedules = await listEnabledSchedules()
  return schedules.find((schedule) => schedule.id === id)
}

/** Written only after a brief is delivered — see `runScheduledBrief`. */
export async function markRun(id: string, at: Date): Promise<void> {
  await agentDb().schedule.update({
    where: { id },
    data: { lastRunAt: at },
  })
}
