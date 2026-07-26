import type { PrismaClient } from '@personal-agent/db'
import { embedDocuments } from '@personal-agent/embedding'

import { embeddingConfig, type IngestConfig } from '../config'
import { adapterFor } from '../feeds/adapters'
import { fetchFeed } from '../feeds/fetch'
import type { FeedItem } from '../feeds/rss'
import type { SourceDefinition } from '../feeds/sources'
import type { ValidatorStore } from '../feeds/validators'
import { retentionCutoff } from './retention'
import { type EmbeddedArticle, findExistingUrls, insertArticles } from './store'

export type PollOutcome = {
  source: string
  status: 'not-modified' | 'polled' | 'failed'
  parsed?: number
  skipped?: number
  stale?: number
  fresh?: number
  inserted?: number
  error?: string
}

export type PollDeps = {
  db: PrismaClient
  config: IngestConfig
  validators: ValidatorStore
  fetchFeedImpl?: typeof fetch
  fetchEmbedImpl?: typeof fetch
  now?: () => Date
}

/** A feed listing the same url twice must not be embedded twice. */
const byUrl = (items: FeedItem[]): FeedItem[] => [
  ...new Map(items.map((item) => [item.url, item])).values(),
]

/** What the model reads. Title first: it carries the most signal per token. */
const embeddingText = (item: FeedItem): string =>
  item.summary ? `${item.title}\n\n${item.summary}` : item.title

export async function pollSource(
  {
    db,
    config,
    validators,
    fetchFeedImpl,
    fetchEmbedImpl,
    now = () => new Date(),
  }: PollDeps,
  source: SourceDefinition,
): Promise<PollOutcome> {
  try {
    const response = await fetchFeed(
      source.feedUrl,
      validators.get(source.id),
      fetchFeedImpl,
    )

    if (response.kind === 'not-modified') {
      return { source: source.name, status: 'not-modified' }
    }

    const adapter = adapterFor(source.adapter)
    if (!adapter) {
      throw new Error(`no adapter named "${source.adapter}"`)
    }

    const { items, skipped } = adapter(response.body)
    const cutoff = retentionCutoff(config.retentionDays, now())

    /**
     * Dropping items the sweep would delete anyway is what keeps a feed's long
     * tail from being embedded — and billed — once per poll forever.
     */
    const deduped = byUrl(items)
    const current = deduped.filter((item) => item.publishedAt >= cutoff)
    const known = await findExistingUrls(
      db,
      current.map((item) => item.url),
    )
    const fresh = current.filter((item) => !known.has(item.url))

    let inserted = 0
    if (fresh.length > 0) {
      const vectors = await embedDocuments(
        fresh.map(embeddingText),
        embeddingConfig(config),
        fetchEmbedImpl,
      )
      const embedded: EmbeddedArticle[] = fresh.map((item, index) => ({
        ...item,
        embedding: vectors[index] as number[],
      }))
      inserted = await insertArticles(
        db,
        source.id,
        embedded,
        config.embeddingModel,
      )
    }

    validators.set(source.id, response.validators)

    return {
      source: source.name,
      status: 'polled',
      parsed: items.length,
      skipped,
      stale: deduped.length - current.length,
      fresh: fresh.length,
      inserted,
    }
  } catch (error) {
    return {
      source: source.name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
