import { parseArgs } from 'node:util'

import { agentDb, disconnectDb } from '../db'
import { EditionSchema } from '../schema'
import {
  isCronExpression,
  isTimeZone,
} from '../worker/scheduling/pattern-checks'
import { runScript } from './run-script'

/**
 * Rows are seeded by hand until the admin API owns them. The `users` row is
 * upserted because the real one is written by the API's auth path, which nothing
 * has called on a fresh database.
 */
const DEFAULT_USER_ID = 'dev'

const { values } = parseArgs({
  options: {
    user: { type: 'string', default: DEFAULT_USER_ID },
    cron: { type: 'string' },
    timezone: { type: 'string' },
    edition: { type: 'string', default: 'morning' },
    topics: { type: 'string' },
  },
  allowPositionals: false,
})

const subjectsOf = (topics: string | undefined): string[] =>
  (topics ?? '')
    .split(',')
    .map((subject) => subject.trim())
    .filter((subject) => subject.length > 0)

await runScript(async () => {
  const cron = values.cron
  if (!cron) {
    throw new Error(
      'Usage: pnpm seed-schedule --cron "0 7 * * *" [--timezone Europe/Prague] [--edition morning] [--user dev] [--topics "rates,semiconductors"]',
    )
  }
  if (!isCronExpression(cron)) {
    throw new Error(`"${cron}" is not a cron expression croner can parse`)
  }

  const timezone =
    values.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!isTimeZone(timezone)) {
    throw new Error(`"${timezone}" is not a valid IANA time zone`)
  }

  const edition = EditionSchema.safeParse(values.edition)
  if (!edition.success) {
    throw new Error(
      `--edition must be morning or evening, not "${values.edition}"`,
    )
  }
  const userId = values.user ?? DEFAULT_USER_ID
  const db = agentDb()

  try {
    await db.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    })

    /**
     * Re-running the seeder states the same intent again, so an existing
     * (user, edition) row is rewritten rather than joined by a second one that
     * would deliver — and bill — every brief twice.
     */
    const existing = await db.schedule.findFirst({
      where: { userId, edition: edition.data },
      orderBy: { createdAt: 'asc' },
    })
    const schedule = existing
      ? await db.schedule.update({
          where: { id: existing.id },
          data: { cron, timezone, enabled: true },
        })
      : await db.schedule.create({
          data: { userId, cron, timezone, edition: edition.data },
        })

    const subjects = subjectsOf(values.topics)
    if (subjects.length > 0) {
      await db.topic.createMany({
        data: subjects.map((subject) => ({
          scheduleId: schedule.id,
          userId,
          subject,
        })),
        skipDuplicates: true,
      })
    }

    console.log(
      `${existing ? 'Updated' : 'Seeded'} ${edition.data} schedule ${schedule.id} — ${cron} (${timezone}) for user ${userId}`,
    )
    if (subjects.length > 0) {
      console.log(`Topics: ${subjects.join(', ')}`)
    }
    console.log(`Fire it now with: pnpm worker -- --once ${schedule.id}`)
  } finally {
    await disconnectDb()
  }
})
