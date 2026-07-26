import { tool } from '@openrouter/agent'
import { z } from 'zod'

import type { SourceProvider } from '../sources/provider'

const SearchInput = z.object({
  query: z
    .string()
    .describe(
      'What you are looking for, in natural language. Empty returns the latest documents.',
    ),
  limit: z.number().int().min(1).max(20).optional(),
})

const FetchInput = z.object({
  id: z.string().describe('Document id as returned by search_news.'),
})

const DEFAULT_LIMIT = 10

/**
 * Search withholds article bodies, so the model must decide which stories are
 * worth a `fetch_article` call rather than receiving the whole corpus at once.
 * Which corpus answers is the provider's business — an in-memory fixture in
 * every eval, Postgres in a scheduled run — and the model cannot tell.
 */
export function createNewsTools(sources: SourceProvider) {
  return [
    tool({
      name: 'search_news',
      description:
        'Search available news documents. Returns ids, titles and publication times — not article text. Use fetch_article to read one.',
      inputSchema: SearchInput,
      execute: async ({ query, limit }) => ({
        results: await sources.search(query, limit ?? DEFAULT_LIMIT),
      }),
    }),

    tool({
      name: 'fetch_article',
      description:
        'Retrieve the full text of one news document by id, for use as a source in the brief.',
      inputSchema: FetchInput,
      execute: async ({ id }) => {
        const doc = await sources.fetch(id)
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
