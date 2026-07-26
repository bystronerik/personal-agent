export type Validators = {
  etag: string | null
  lastModified: string | null
}

export type FeedResponse =
  | { kind: 'not-modified' }
  | { kind: 'fetched'; body: string; validators: Validators }

const USER_AGENT =
  'personal-agent/0.1 (+https://github.com/personal-agent; brief aggregator)'

const REQUEST_TIMEOUT_MS = 20_000
const NOT_MODIFIED = 304

/**
 * A conditional request: a feed polled hourly answers 304 with no body when
 * nothing has changed, which is the difference between being a good citizen and
 * being rate-limited. The validators are held in memory for the life of the
 * process, so the first poll after a restart is unconditional.
 */
export async function fetchFeed(
  url: string,
  validators: Validators,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedResponse> {
  const headers = new Headers({
    'user-agent': USER_AGENT,
    accept: 'application/rss+xml, application/xml, text/xml, */*',
  })
  if (validators.etag) headers.set('if-none-match', validators.etag)
  if (validators.lastModified) {
    headers.set('if-modified-since', validators.lastModified)
  }

  const response = await fetchImpl(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status === NOT_MODIFIED) return { kind: 'not-modified' }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return {
    kind: 'fetched',
    body: await response.text(),
    validators: {
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    },
  }
}
