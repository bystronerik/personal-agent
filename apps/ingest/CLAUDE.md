# @personal-agent/ingest

The corpus poller. Entry point: `src/main.ts`. It upserts a `sources` row for each feed,
starts one croner job for each feed, and sweeps expired articles every hour at minute 17.
`apps/agent` reads what this app writes. There is no import between the two.

## Scripts

| Script | Effect |
| --- | --- |
| `ingest` | Run the poller. Add `--once` to poll each feed one time, sweep, and exit |
| `test` | Vitest |
| `build` | `tsc`, then rolldown to `dist/main.js` |

Use `pnpm --filter @personal-agent/ingest ingest --once` to fill an empty corpus. The
root `pnpm start` does not start this app, because embedding costs money.

## Structure

- `src/feeds/sources.ts` — the feed list, as a const. Each entry has a name, a feed URL
  and its own cron cadence. `ensureSources` upserts the rows on each boot.
- `src/feeds/fetch.ts` — a conditional GET. It sends `If-None-Match` and
  `If-Modified-Since`, and it reports a 304 as `not-modified`.
- `src/feeds/rss.ts` and `adapters.ts` — parse a feed body into `FeedItem`s.
- `src/ingest/poll.ts` — one poll cycle: fetch, parse, drop duplicates, drop stale and
  known items, embed the rest, insert. `store.ts` inserts and `retention.ts` sweeps.
- `src/runtime/` — signal handling and a drain that waits for in-flight work.

## Gotchas

- A new feed goes in `src/feeds/sources.ts`. There is no seeding step and no admin UI
  for feeds. `resolve()` validates the cron, the time zone and the adapter at load time,
  so a bad entry fails the boot.
- If you delete an entry, the `sources` row and its articles stay until retention sweeps
  them.
- `insertArticles` uses raw SQL. Prisma cannot write the `halfvec` column. Keep
  `ON CONFLICT (url) DO NOTHING`, which makes a re-poll idempotent.
- `OPENROUTER_EMBEDDING_DIMENSIONS` must equal the width of `articles.embedding`. A
  change needs a migration and a full re-embed.
- The poller embeds only items inside the retention window, and it holds the HTTP
  validators in memory. Do not remove the window filter, or a long feed tail is embedded
  and billed on each poll.
