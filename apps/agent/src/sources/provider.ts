import type { SourceDoc } from '../schema'

/** What search returns: enough to choose, never the body. */
export type SourceRef = Pick<SourceDoc, 'id' | 'title' | 'publishedAt'>

/**
 * Where a run's corpus comes from. Two implementations: `fixture.ts` over an
 * in-memory array, which is what every eval and test uses, and `corpus.ts` over
 * Postgres, which is what a scheduled brief uses.
 *
 * The interface is the reason the agent core can import `packages/db` without
 * every test needing a database: nothing here reaches for a provider, so the
 * caller decides, and `corpus.ts` is simply never imported on the fixture path.
 */
export type SourceProvider = {
  /** Ids, titles and times only — the model must fetch to read a story. */
  search(query: string, limit: number): Promise<SourceRef[]>
  fetch(id: string): Promise<SourceDoc | undefined>
}
