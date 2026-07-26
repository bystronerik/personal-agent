import { describe, expect, it } from 'vitest'

import { fetchFeed } from './fetch'

type Captured = { url: string; headers: Headers }

const capturing = (response: Response) => {
  const seen: Captured[] = []
  const fetchImpl = ((url: string, init: RequestInit) => {
    seen.push({ url, headers: new Headers(init.headers) })
    return Promise.resolve(response)
  }) as unknown as typeof fetch
  return { seen, fetchImpl }
}

describe('fetchFeed', () => {
  it('sends stored validators so an unchanged feed can answer 304', async () => {
    const { seen, fetchImpl } = capturing(new Response(null, { status: 304 }))

    const result = await fetchFeed(
      'https://example.org/feed',
      { etag: 'W/"abc"', lastModified: 'Tue, 14 Jul 2026 18:00:00 GMT' },
      fetchImpl,
    )

    expect(result).toEqual({ kind: 'not-modified' })
    expect(seen[0]?.headers.get('if-none-match')).toBe('W/"abc"')
    expect(seen[0]?.headers.get('if-modified-since')).toBe(
      'Tue, 14 Jul 2026 18:00:00 GMT',
    )
  })

  it('omits the conditional headers on a first poll', async () => {
    const { seen, fetchImpl } = capturing(new Response('<rss/>'))

    await fetchFeed(
      'https://example.org/feed',
      { etag: null, lastModified: null },
      fetchImpl,
    )

    expect(seen[0]?.headers.get('if-none-match')).toBeNull()
    expect(seen[0]?.headers.get('if-modified-since')).toBeNull()
  })

  it('returns the body and the validators to store for next time', async () => {
    const { fetchImpl } = capturing(
      new Response('<rss/>', {
        status: 200,
        headers: {
          etag: 'W/"new"',
          'last-modified': 'Wed, 15 Jul 2026 06:00:00 GMT',
        },
      }),
    )

    const result = await fetchFeed(
      'https://example.org/feed',
      { etag: null, lastModified: null },
      fetchImpl,
    )

    expect(result).toEqual({
      kind: 'fetched',
      body: '<rss/>',
      validators: {
        etag: 'W/"new"',
        lastModified: 'Wed, 15 Jul 2026 06:00:00 GMT',
      },
    })
  })

  it('throws on a failure status so the poll is reported, not silently empty', async () => {
    const { fetchImpl } = capturing(
      new Response('nope', { status: 403, statusText: 'Forbidden' }),
    )

    await expect(
      fetchFeed(
        'https://example.org/feed',
        { etag: null, lastModified: null },
        fetchImpl,
      ),
    ).rejects.toThrow(/403/)
  })
})
