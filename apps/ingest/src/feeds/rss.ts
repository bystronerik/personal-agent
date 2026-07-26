import { XMLParser } from 'fast-xml-parser'

export type FeedItem = {
  url: string
  title: string
  summary: string
  publishedAt: Date
}

export type ParsedFeed = {
  items: FeedItem[]
  /** Items dropped for want of a url, title, or usable date. */
  skipped: number
}

/**
 * `processEntities` decodes `&amp;` and friends, and CDATA sections become plain
 * text values — which is what the Fed's feed needs, since it wraps `link`,
 * `guid`, `description` and `pubDate` in CDATA that a regex reader sees as empty.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: true,
  trimValues: true,
})

type Node = Record<string, unknown>

const asArray = (value: unknown): unknown[] => {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null

/** The document is parsed XML, so every level is `unknown` until it is checked. */
const at = (root: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (node, key) => (isNode(node) ? node[key] : undefined),
    root,
  )

const text = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && '#text' in value) {
    return text((value as { '#text': unknown })['#text'])
  }
  return ''
}

const TAGS = /<[^>]*>/g
const WHITESPACE = /\s+/g

const plain = (value: unknown): string =>
  text(value).replace(TAGS, ' ').replace(WHITESPACE, ' ').trim()

/** Atom spells the target as an attribute; RSS puts it in the element body. */
function linkOf(item: Node): string {
  const direct = text(item.link)
  if (direct) return direct
  const link = item.link
  if (link && typeof link === 'object' && '@_href' in link) {
    return String((link as { '@_href': unknown })['@_href'])
  }
  return text(item.guid)
}

/**
 * A feed date that will not parse drops its item rather than defaulting to now:
 * a stale article dated `now()` would outrank every real one in a
 * recency-weighted search, and would never age out of the retention window.
 */
function dateOf(item: Node): Date | undefined {
  const raw = text(item.pubDate) || text(item.published) || text(item.updated)
  if (!raw) return undefined
  const parsed = new Date(raw.replace(WHITESPACE, ' '))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function parseFeed(body: string): ParsedFeed {
  const document: unknown = parser.parse(body)
  const entries = [
    ...asArray(at(document, 'rss', 'channel', 'item')),
    ...asArray(at(document, 'rdf:RDF', 'item')),
    ...asArray(at(document, 'feed', 'entry')),
  ].filter(isNode)

  const items: FeedItem[] = []
  let skipped = 0

  for (const entry of entries) {
    const url = linkOf(entry)
    const title = plain(entry.title)
    const publishedAt = dateOf(entry)
    if (!url || !title || !publishedAt) {
      skipped += 1
      continue
    }
    items.push({
      url,
      title,
      summary: plain(entry.description ?? entry.summary ?? entry.content),
      publishedAt,
    })
  }

  return { items, skipped }
}
