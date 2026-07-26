import type { PrismaClient } from '@personal-agent/db'

import { isCronExpression, isTimeZone } from '../runtime/pattern-checks'
import { adapterFor, adapterNames } from './adapters'

export type SourceDefinition = {
  id: string
  name: string
  feedUrl: string
  adapter: string
  cron: string
  timezone: string
}

type FeedEntry = {
  name: string
  feedUrl: string
  cron: string
  adapter?: string
  timezone?: string
}

const DEFAULT_ADAPTER = 'rss'
const DEFAULT_TIMEZONE = 'UTC'

/**
 * Every URL here was fetched and parsed before being written down. Cadence is
 * per feed because a central bank publishes on a schedule and a newspaper does
 * not: polling the ECB hourly would be 24 conditional requests for two documents.
 *
 * Removing an entry stops the polling and nothing else — the `sources` row and
 * the articles attributed to it stay until retention sweeps them.
 */
const FEEDS: FeedEntry[] = [
  {
    name: 'Federal Reserve — monetary policy',
    feedUrl: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
    cron: '0 6,18 * * *',
  },
  {
    name: 'Federal Reserve — all press',
    feedUrl: 'https://www.federalreserve.gov/feeds/press_all.xml',
    cron: '15 6,18 * * *',
  },
  {
    name: 'ECB — press',
    feedUrl: 'https://www.ecb.europa.eu/rss/press.html',
    cron: '30 6,18 * * *',
  },
  {
    name: 'Bank of England — news',
    feedUrl: 'https://www.bankofengland.co.uk/rss/news',
    cron: '45 6,18 * * *',
  },
  {
    name: 'EIA — Today in Energy',
    feedUrl: 'https://www.eia.gov/rss/todayinenergy.xml',
    cron: '0 12 * * *',
  },
  {
    name: 'Guardian — business',
    feedUrl: 'https://www.theguardian.com/business/rss',
    cron: '5 * * * *',
  },
]

/**
 * Checked at load rather than at the first fire: croner throws on an unparseable
 * pattern but accepts an unknown `timezone` silently, so a typo there would poll
 * at some unintended hour instead of failing. `--once` builds no croner job at
 * all, which is the other reason neither check can wait for one.
 */
const resolve = (entry: FeedEntry): Omit<SourceDefinition, 'id'> => {
  const feed = {
    ...entry,
    adapter: entry.adapter ?? DEFAULT_ADAPTER,
    timezone: entry.timezone ?? DEFAULT_TIMEZONE,
  }
  const problem = !isCronExpression(feed.cron)
    ? `cron "${feed.cron}" is not a valid expression`
    : !isTimeZone(feed.timezone)
      ? `timezone "${feed.timezone}" is not a valid IANA zone`
      : adapterFor(feed.adapter) === undefined
        ? `adapter "${feed.adapter}" is not known (have: ${adapterNames().join(', ')})`
        : undefined
  if (problem) throw new Error(`Feed ${feed.name}: ${problem}`)
  return feed
}

const DEFINITIONS = FEEDS.map(resolve)

/**
 * The feed list is code, but `articles.source_id` is a foreign key — so each
 * definition still needs a row to point at. Keying the upsert on `feedUrl` is
 * what preserves identity across restarts: the row's id, and every article
 * already attributed to it, survive a rename or a cadence change.
 *
 * `name` is the only field of a definition the row carries. Cadence, zone and
 * adapter are not written at all: a column nothing reads is a second copy of the
 * list that can silently disagree with the const above it.
 */
export async function ensureSources(
  db: PrismaClient,
): Promise<SourceDefinition[]> {
  const sources: SourceDefinition[] = []
  for (const definition of DEFINITIONS) {
    const { name, feedUrl } = definition
    const { id } = await db.source.upsert({
      where: { feedUrl },
      create: { name, feedUrl },
      update: { name },
      select: { id: true },
    })
    sources.push({ ...definition, id })
  }
  return sources
}
