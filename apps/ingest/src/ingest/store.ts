import { randomUUID } from 'node:crypto'

import type { PrismaClient } from '@personal-agent/db'
import { type Embedding, vectorLiteral } from '@personal-agent/embedding'

import type { FeedItem } from '../feeds/rss'

export type EmbeddedArticle = FeedItem & { embedding: Embedding }

export async function findExistingUrls(
  db: PrismaClient,
  urls: string[],
): Promise<Set<string>> {
  if (urls.length === 0) return new Set()
  const rows = await db.article.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  })
  return new Set(rows.map((row) => row.url))
}

/**
 * Raw SQL because `articles.embedding` is `Unsupported("halfvec(4000)")`, which
 * Prisma can create but neither write nor select. `ON CONFLICT (url) DO NOTHING`
 * is what makes a re-poll idempotent — two pollers, or a feed that lists an item
 * twice, cost one row.
 */
export async function insertArticles(
  db: PrismaClient,
  sourceId: string,
  articles: EmbeddedArticle[],
  embeddingModel: string,
): Promise<number> {
  let inserted = 0
  for (const article of articles) {
    inserted += await db.$executeRaw`
      INSERT INTO articles (id, source_id, url, title, summary, published_at, embedding, embedding_model)
      VALUES (
        ${randomUUID()}, ${sourceId}, ${article.url}, ${article.title},
        ${article.summary}, ${article.publishedAt},
        ${vectorLiteral(article.embedding)}::halfvec, ${embeddingModel}
      )
      ON CONFLICT (url) DO NOTHING
    `
  }
  return inserted
}
