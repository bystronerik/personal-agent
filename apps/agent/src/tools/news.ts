import { tool } from '@openrouter/agent'
import { z } from 'zod'
import type { SourceDoc } from '../schema'

const SearchInput = z.object({
  query: z
    .string()
    .describe('Space-separated keywords. Empty returns the latest documents.'),
  limit: z.number().int().min(1).max(20).optional(),
})

const FetchInput = z.object({
  id: z.string().describe('Document id as returned by search_news.'),
})

const DEFAULT_LIMIT = 10

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

function search(docs: SourceDoc[], query: string, limit: number): SourceDoc[] {
  const terms = termsOf(query)
  if (terms.length === 0) return [...docs].sort(newest).slice(0, limit)

  return docs
    .map((doc) => ({ doc, score: relevance(doc, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || newest(a.doc, b.doc))
    .slice(0, limit)
    .map(({ doc }) => doc)
}

/**
 * Search withholds article bodies, so the model must decide which stories are
 * worth a `fetch_article` call rather than receiving the whole corpus at once.
 */
export function createNewsTools(docs: SourceDoc[]) {
  return [
    tool({
      name: 'search_news',
      description:
        'Search available news documents. Returns ids, titles and publication times — not article text. Use fetch_article to read one.',
      inputSchema: SearchInput,
      execute: ({ query, limit }) => ({
        results: search(docs, query, limit ?? DEFAULT_LIMIT).map(
          ({ id, title, publishedAt }) => ({ id, title, publishedAt }),
        ),
      }),
    }),

    tool({
      name: 'fetch_article',
      description:
        'Retrieve the full text of one news document by id, for use as a source in the brief.',
      inputSchema: FetchInput,
      execute: ({ id }) => {
        const doc = docs.find((candidate) => candidate.id === id)
        if (!doc) {
          throw new Error(
            `no document with id "${id}" — call search_news first to list valid ids`,
          )
        }
        return doc
      },
    }),
  ]
}
