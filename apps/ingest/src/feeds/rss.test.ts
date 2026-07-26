import { describe, expect, it } from 'vitest'

import { parseFeed } from './rss'

const feed = (items: string) => `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Test</title>${items}</channel></rss>`

describe('parseFeed', () => {
  it('reads a plain RSS item', () => {
    const { items, skipped } = parseFeed(
      feed(`<item>
        <title>Policy rate held at 4.25 percent</title>
        <link>https://example.org/a</link>
        <description>The board voted to hold.</description>
        <pubDate>Tue, 14 Jul 2026 18:00:00 GMT</pubDate>
      </item>`),
    )

    expect(skipped).toBe(0)
    expect(items).toEqual([
      {
        url: 'https://example.org/a',
        title: 'Policy rate held at 4.25 percent',
        summary: 'The board voted to hold.',
        publishedAt: new Date('2026-07-14T18:00:00Z'),
      },
    ])
  })

  /** The Fed wraps these four fields; a regex reader sees empty strings. */
  it('unwraps CDATA, as the Federal Reserve feed requires', () => {
    const { items } = parseFeed(
      feed(`<item>
        <title>Minutes of the discount rate meetings</title>
        <link><![CDATA[https://example.org/cdata]]></link>
        <description><![CDATA[Minutes of the meetings]]></description>
        <pubDate><![CDATA[Tue, 14 Jul 2026 18:00:00 GMT]]></pubDate>
      </item>`),
    )

    expect(items[0]?.url).toBe('https://example.org/cdata')
    expect(items[0]?.publishedAt).toEqual(new Date('2026-07-14T18:00:00Z'))
  })

  /** EIA sends a doubled space and a zone abbreviation, not strict RFC 822. */
  it('tolerates a loose pubDate', () => {
    const { items } = parseFeed(
      feed(`<item>
        <title>Crude oil inventories rose</title>
        <link>https://example.org/eia</link>
        <pubDate>Fri, 24 Jul 2026  09:00:00 EST</pubDate>
      </item>`),
    )

    expect(items[0]?.publishedAt).toEqual(new Date('2026-07-24T14:00:00Z'))
  })

  /**
   * A defaulted date would outrank every real article in a recency-weighted
   * search and would never age out of the retention window.
   */
  it('skips an item whose date will not parse rather than dating it now', () => {
    const { items, skipped } = parseFeed(
      feed(`<item>
        <title>Undated</title>
        <link>https://example.org/undated</link>
        <pubDate>whenever</pubDate>
      </item>`),
    )

    expect(items).toEqual([])
    expect(skipped).toBe(1)
  })

  it('skips items with no url or no title', () => {
    const { items, skipped } = parseFeed(
      feed(`<item><title>No link</title><pubDate>Tue, 14 Jul 2026 18:00:00 GMT</pubDate></item>
        <item><link>https://example.org/b</link><pubDate>Tue, 14 Jul 2026 18:00:00 GMT</pubDate></item>`),
    )

    expect(items).toEqual([])
    expect(skipped).toBe(2)
  })

  it('strips markup from a summary so the embedding reads prose', () => {
    const { items } = parseFeed(
      feed(`<item>
        <title>Markets</title>
        <link>https://example.org/c</link>
        <description>&lt;p&gt;Shares fell &lt;b&gt;7.5%&lt;/b&gt;&lt;/p&gt;</description>
        <pubDate>Tue, 14 Jul 2026 18:00:00 GMT</pubDate>
      </item>`),
    )

    expect(items[0]?.summary).toBe('Shares fell 7.5%')
  })

  it('handles a single item, which XML gives as an object not an array', () => {
    const { items } = parseFeed(
      feed(`<item>
        <title>Only one</title>
        <link>https://example.org/one</link>
        <pubDate>Tue, 14 Jul 2026 18:00:00 GMT</pubDate>
      </item>`),
    )

    expect(items).toHaveLength(1)
  })

  it('returns nothing for a feed with no items', () => {
    expect(parseFeed(feed(''))).toEqual({ items: [], skipped: 0 })
  })
})
