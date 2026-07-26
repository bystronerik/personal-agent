import type { PrismaClient } from '@personal-agent/db'

const DAY_MS = 24 * 60 * 60 * 1000

export const retentionCutoff = (retentionDays: number, now: Date): Date =>
  new Date(now.getTime() - retentionDays * DAY_MS)

/**
 * Without this the table grows without bound and the HNSW index degrades with
 * it. Bounded retention is also what keeps the recency-filtered scan the agent
 * issues in the tens of milliseconds.
 */
export async function sweepExpired(
  db: PrismaClient,
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await db.article.deleteMany({
    where: { publishedAt: { lt: retentionCutoff(retentionDays, now) } },
  })
  return count
}
