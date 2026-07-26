import { agentDb } from '../../db'
import type { Brief } from '../../schema'

/**
 * Records which articles a schedule has now been sent, so `corpusProvider`
 * can exclude them from the next brief and the reader is not told the same
 * story twice.
 *
 * `skipDuplicates` rather than a transaction: two headlines can legitimately
 * cite the same document, and a re-delivery of the same occurrence must not
 * fail. Cited ids come from the model, so an id that no longer resolves — an
 * article swept between research and delivery — is dropped rather than raised:
 * failing here would lose a brief that has already been sent.
 */
export async function recordDelivered(
  scheduleId: string,
  brief: Brief,
  briefRunAt: Date,
): Promise<number> {
  const articleIds = [
    ...new Set(brief.headlines.flatMap((headline) => headline.sourceIds)),
  ]
  if (articleIds.length === 0) return 0

  const known = await agentDb().article.findMany({
    where: { id: { in: articleIds } },
    select: { id: true },
  })

  const { count } = await agentDb().articleDelivery.createMany({
    data: known.map((article) => ({
      scheduleId,
      articleId: article.id,
      briefRunAt,
    })),
    skipDuplicates: true,
  })
  return count
}
