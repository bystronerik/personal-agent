import { describe, expect, it } from 'vitest'

import type { SourceDoc } from '../schema'
import { fixtureProvider } from './fixture'

const docs: SourceDoc[] = [
  {
    id: 'doc-01',
    title: 'Central bank holds policy rate',
    body: 'The board held the rate at 4.25 percent.',
    publishedAt: '2026-07-19T14:30:00Z',
  },
  {
    id: 'doc-02',
    title: 'Container rates climb',
    body: 'Shipping rates rose 64 percent after two carriers suspended transits.',
    publishedAt: '2026-07-20T09:15:00Z',
  },
  {
    id: 'doc-03',
    title: 'Crude eases as pipeline restarts',
    body: 'Benchmark crude settled lower on the week.',
    publishedAt: '2026-07-18T18:00:00Z',
  },
]

describe('fixtureProvider', () => {
  /**
   * The discipline the whole tool design rests on: the model has to choose what
   * to read, so search must never hand back a body.
   */
  it('withholds article bodies from search results', async () => {
    const [first] = await fixtureProvider(docs).search('policy rate', 5)

    expect(first).toEqual({
      id: 'doc-01',
      title: 'Central bank holds policy rate',
      publishedAt: '2026-07-19T14:30:00Z',
    })
    expect(first).not.toHaveProperty('body')
  })

  it('ranks by how many query terms the document contains', async () => {
    const results = await fixtureProvider(docs).search('shipping carriers', 5)

    expect(results.map((result) => result.id)).toEqual(['doc-02'])
  })

  it('returns the newest documents when the query has no usable terms', async () => {
    const results = await fixtureProvider(docs).search('', 2)

    expect(results.map((result) => result.id)).toEqual(['doc-02', 'doc-01'])
  })

  it('honours the limit', async () => {
    expect(await fixtureProvider(docs).search('rate', 1)).toHaveLength(1)
  })

  it('fetches a full document by id', async () => {
    const doc = await fixtureProvider(docs).fetch('doc-03')

    expect(doc?.body).toContain('Benchmark crude')
  })

  /** The tool turns this into the error that tells the model to search first. */
  it('resolves undefined for an unknown id', async () => {
    expect(await fixtureProvider(docs).fetch('nope')).toBeUndefined()
  })

  it('searches an empty corpus without throwing', async () => {
    expect(await fixtureProvider([]).search('anything', 5)).toEqual([])
  })
})
