import type { SourceDoc } from '../schema'
import type { SourceProvider, SourceRef } from './provider'

const termsOf = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)

/** Number of query terms appearing anywhere in the document. */
function relevance(doc: SourceDoc, terms: string[]): number {
  const haystack = `${doc.title} ${doc.body}`.toLowerCase()
  return terms.filter((term) => haystack.includes(term)).length
}

const newest = (a: SourceDoc, b: SourceDoc): number =>
  Date.parse(b.publishedAt) - Date.parse(a.publishedAt)

const asRef = ({ id, title, publishedAt }: SourceDoc): SourceRef => ({
  id,
  title,
  publishedAt,
})

/**
 * Keyword scoring over an in-memory array — no network, no database, no key.
 * This is what every eval and unit test passes, and what keeps `pnpm eval` free
 * and deterministic now that the core can reach Postgres.
 */
export function fixtureProvider(docs: SourceDoc[]): SourceProvider {
  return {
    search(query, limit) {
      const terms = termsOf(query)
      if (terms.length === 0) {
        return Promise.resolve(
          [...docs].sort(newest).slice(0, limit).map(asRef),
        )
      }

      return Promise.resolve(
        docs
          .map((doc) => ({ doc, score: relevance(doc, terms) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || newest(a.doc, b.doc))
          .slice(0, limit)
          .map(({ doc }) => asRef(doc)),
      )
    },

    fetch(id) {
      return Promise.resolve(docs.find((doc) => doc.id === id))
    },
  }
}
