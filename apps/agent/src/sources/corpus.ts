import { embedQuery, vectorLiteral } from '@personal-agent/embedding'

import { loadEmbeddingConfig } from '../config'
import { agentDb } from '../db'
import { type SourceDoc, SourceDocSchema } from '../schema'
import type { SourceProvider, SourceRef } from './provider'

export type CorpusOptions = {
  /** How far back a search may reach. A brief is about now, not about July. */
  windowHours?: number
  /**
   * Excludes what this schedule has already sent, so tomorrow's brief does not
   * repeat today's story. Absent for a one-off run, which has nothing to repeat.
   */
  scheduleId?: string
}

const DEFAULT_WINDOW_HOURS = 72
/** Candidates drawn from each ranker before fusing — not what the caller sees. */
const CANDIDATE_DEPTH = 50
/** Standard reciprocal-rank-fusion damping; large enough that rank 1 is not absolute. */
const RRF_K = 60

type SearchRow = { id: string; title: string; published_at: Date }
type DocRow = {
  id: string
  title: string
  summary: string
  body: string | null
  published_at: Date
}

const windowStart = (hours: number): Date =>
  new Date(Date.now() - hours * 60 * 60 * 1000)

/**
 * Reads the corpus `apps/ingest` writes. Two rankers are fused rather than one
 * chosen: embeddings carry meaning but handle tickers and proper nouns worst,
 * and full-text is the reverse. Reciprocal rank fusion needs no score
 * calibration between them, which matters because their scales are unrelated.
 *
 * The recency filter comes first, and is not a tiebreak: cosine distance alone
 * will happily return a well-matched article from three weeks ago, which is
 * worse than useless in a morning brief.
 */
export function corpusProvider(options: CorpusOptions = {}): SourceProvider {
  const windowHours = options.windowHours ?? DEFAULT_WINDOW_HOURS
  const scheduleId = options.scheduleId ?? null

  return {
    async search(query, limit): Promise<SourceRef[]> {
      const db = agentDb()
      const vector = vectorLiteral(
        await embedQuery(query, loadEmbeddingConfig()),
      )
      const since = windowStart(windowHours)

      const rows = await db.$queryRaw<SearchRow[]>`
        WITH pool AS (
          SELECT a.id, a.title, a.summary, a.published_at, a.embedding
          FROM articles a
          WHERE a.published_at >= ${since}
            AND NOT EXISTS (
              SELECT 1 FROM article_deliveries d
              WHERE d.article_id = a.id AND d.schedule_id = ${scheduleId}
            )
        ),
        vec AS (
          SELECT id, row_number() OVER (
            ORDER BY embedding <=> ${vector}::halfvec
          ) AS rnk
          FROM pool
          WHERE embedding IS NOT NULL
          LIMIT ${CANDIDATE_DEPTH}
        ),
        fts AS (
          SELECT id, row_number() OVER (
            ORDER BY ts_rank(
              to_tsvector('english', title || ' ' || summary),
              plainto_tsquery('english', ${query})
            ) DESC
          ) AS rnk
          FROM pool
          WHERE to_tsvector('english', title || ' ' || summary)
                @@ plainto_tsquery('english', ${query})
          LIMIT ${CANDIDATE_DEPTH}
        )
        SELECT p.id, p.title, p.published_at
        FROM pool p
        LEFT JOIN vec ON vec.id = p.id
        LEFT JOIN fts ON fts.id = p.id
        WHERE vec.id IS NOT NULL OR fts.id IS NOT NULL
        ORDER BY
          COALESCE(1.0 / (${RRF_K} + vec.rnk), 0)
          + COALESCE(1.0 / (${RRF_K} + fts.rnk), 0) DESC,
          p.published_at DESC
        LIMIT ${limit}
      `

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        publishedAt: row.published_at.toISOString(),
      }))
    },

    async fetch(id): Promise<SourceDoc | undefined> {
      const db = agentDb()
      const [row] = await db.$queryRaw<DocRow[]>`
        SELECT id, title, summary, body, published_at
        FROM articles WHERE id = ${id}
      `
      if (!row) return undefined

      /**
       * `body` is null for every feed-sourced article — ingest stores the
       * summary and the link rather than warehousing article text — so the
       * summary is the body, and `SourceDocSchema` requires it to be non-empty.
       */
      return SourceDocSchema.parse({
        id: row.id,
        title: row.title,
        body: row.body ?? row.summary,
        publishedAt: row.published_at.toISOString(),
      })
    },
  }
}
