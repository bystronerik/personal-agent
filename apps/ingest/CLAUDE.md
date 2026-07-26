# `@personal-agent/ingest`

The corpus poller: it holds a static feed list, fetches each feed on its own
schedule, embeds what is new, and sweeps what has aged out. It writes
`packages/db` and talks to OpenRouter's embeddings endpoint; it knows nothing
about briefs, Telegram, or chat models. See the
[root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

**Nothing imports this app** — like `apps/agent` it is top-of-graph, so its own
`build` (`tsc --noEmit && rolldown`) is what catches the ESM and type mistakes a
consumer otherwise would. `apps/agent` reads the rows it writes, but through the
database, never through an import.

## Layout

```
src/config.ts        loadIngestConfig — DATABASE_URL, OPENROUTER_*, retention
src/db.ts            the memoized Prisma client
src/sources.ts       the feed list itself + ensureSources (the row per feed)
src/pattern-checks.ts  cron/zone validation, run over the list at load
src/main.ts          wiring: croner jobs, sweep, --once
src/runtime/         shutdown + signal handling
src/feeds/           fetch.ts (conditional GET), validators.ts (the in-memory
                     etag store), rss.ts (parser), adapters.ts
src/ingest/          poll.ts (the pipeline), store.ts (raw-SQL insert),
                     retention.ts (the sweep)
```

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | `tsc --noEmit && rolldown` → `dist/main.js`. The `tsc` half is not decoration: rolldown strips types with oxc and never checks them. |
| `pnpm test` | `vitest run`. Every test is offline — the parser, the conditional-GET headers and the retention arithmetic all run against fakes. The embedding client's own tests live in `packages/embedding`. |
| `pnpm ingest` | The long-running poller. Needs Postgres and an OpenRouter key. |
| `pnpm ingest --once` | Poll every source once, sweep, exit. The whole pipeline without waiting for a cron hour. |

There is no seed step: both paths call `ensureSources` before polling, so a fresh
database ingests on the first run.

`ingest` is deliberately **not** called `start:dev`, so root `pnpm start` does not
fan out to it — embedding costs money, so it is its own command, the same reason
the brief worker is not `dev`.

## The pipeline

Per source, `ingest/poll.ts`: conditional GET → parse → drop stale → drop known →
embed the remainder in one request → insert → record validators. Four of those
steps exist to avoid paying twice:

- **`etag`/`lastModified` live in `feeds/validators.ts`**, a map for the life of
  the process. Four of the six feeds answer 304 on a second poll and cost nothing.
  A restart loses them, and that is affordable precisely because of the next two
  bullets: the refetched feed is parsed and thrown away, never re-embedded.
- **Items older than the retention cutoff are dropped before embedding.** A feed's
  long tail would otherwise be embedded on every poll and swept every night,
  forever. This is why `retentionCutoff` is exported and not private to the sweep.
- **Known urls are filtered before embedding**, not after: the insert would
  discard them anyway, but the embedding is already bought by then.
- **`ON CONFLICT (url) DO NOTHING`** is what makes a re-poll idempotent — two
  pollers, or a feed listing an item twice, cost one row.

**A poll never throws.** `pollSource` returns a `PollOutcome` with a status, so one
dead feed reports itself and the other five still run. **A bad feed *definition*
is the opposite** — `sources.ts` validates the list at module load and throws, so
a typo fails the boot in front of whoever deployed it rather than degrading to
five feeds nobody notices. A row could only be reported and skipped, because
nobody was watching when it was edited; a const cannot reach production unwatched.

## Storage is raw SQL, and has to be

`articles.embedding` is `Unsupported("halfvec(4000)")`, which Prisma can create but
neither write nor read. `ingest/store.ts` therefore inserts through `$executeRaw`
with a `'[...]'::halfvec` cast. Anything that needs to *search* those vectors —
`apps/agent`'s `sources/corpus.ts` — is in the same position, and does the same,
which is why the literal itself is `@personal-agent/embedding`'s `vectorLiteral`
rather than a helper in each app.

## Embedding

Through `@personal-agent/embedding`, never a local client: this app embeds
**documents** (plain text) and `apps/agent` embeds **queries** (wrapped in a
retrieval instruction), and those two halves have to stay in step. That package
explains why, and owns the width check that a mismatched `dimensions` would
otherwise surface as an unreadable Postgres error.

## Scheduling, and why the feed list is code

Each entry in `sources.ts` carries its own `cron` and `timezone` — a central bank
publishes on a schedule and a newspaper does not — but unlike `apps/agent`'s
worker **the list is not read from Postgres**. The jobs arm once at boot and never
reconcile, which is the whole simplification: no registry, no diff, no 30-second
timer, no per-row parse. The reasoning is that the two schedules are owned by
different people. A reader edits their own brief schedule and must not need a
deploy; the trusted feed list is ours alone, and as code it gets review, a
typecheck, and a fresh clone that ingests with no seeding step. The price is that
retuning a cadence or muting a noisy feed is a deploy, not a row edit.

**A `sources` row still exists per feed, and `ensureSources` upserts it at boot.**
`articles.source_id` is a foreign key, so each feed needs a stable id to attribute
articles to. The upsert keys on `feedUrl`, which is what keeps that id — and every
article already pointing at it — across a rename or a cadence change. The mirrored
columns (`cron`, `timezone`, `adapter`, `name`) are written but never read back,
so `db:studio` cannot show a schedule that stopped being true at the last deploy;
`etag`, `lastModified` and `lastPolledAt` are no longer written at all. **Deleting
an entry stops the polling and nothing else** — the row and its articles stay,
because cascading a feed's removal into the corpus would silently shrink briefs.

The rest of the shape follows the worker's, and where it differs it is deliberate:

- **No catch-up, no attempt ledger, no `lastRunAt` floor.** A missed poll
  self-heals: the next one sees the same feed items, because a feed is a window on
  the present rather than an occurrence that can be missed. A missed *brief* is a
  lost paid run, which is why the worker carries all three and this does not.
- **`pattern-checks.ts` is duplicated** from the worker rather than shared. Apps do
  not import apps, and extracting `packages/scheduling` for two callers that need
  different amounts of it would cost more than twenty lines of duplication. If a
  third consumer appears, extract it then. Both checks are now run at module load
  over a const rather than per row — and `isTimeZone` still earns its keep, since
  croner accepts an unknown zone silently and would poll at some unintended hour.
  `--once` builds no croner job at all, so it is the only thing between a typo and
  a silently mis-scheduled feed on that path.
- **Overlap protection is a running set in `main.ts`**, so a feed slower than its
  own interval cannot poll itself twice.
- **A single instance is assumed.** Two replicas would each poll every source;
  `ON CONFLICT` keeps that correct, but it pays for every embedding twice. They
  would also hold separate validator maps, so neither sees the other's 304s.

## Deliberately not built

- **Near-duplicate detection.** Syndication means one story can arrive from several
  outlets, and cosine distance is the way to catch it — but the threshold has to
  come from observed data. Guessing one silently drops real articles, which is
  worse than storing a duplicate. Revisit once the corpus is large enough to
  measure.
- **Labelling.** Embeddings and full-text already answer "what is this about", and
  no consumer wanted a tag. `Article` has no `labels` column for that reason.
- **Article bodies.** Only the feed's title and summary are stored, which is what
  the embedding reads and what a cited brief needs. Fetching and warehousing full
  article text raises a republishing question the product does not need to answer.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
