# `@personal-agent/db`

Owns the Prisma schema, the migrations, and the generated client. **The only
package that talks to Postgres** — nothing else constructs a Prisma client or
handles a connection string. One workspace dependency: `@personal-agent/env`
(CLI-time, for `DATABASE_URL`); two consumers: `apps/server` and `apps/agent`'s
worker. See the [root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

Both consumers construct through `createPrismaClient` and hold the result — the
server in `PrismaService`, the worker in a memoized `src/worker/db.ts`. **Query
code is not shared**: the server's is user-scoped CRUD and the worker's is a
single "which schedules are enabled" read, and a repository layer here would be
the first query code in this package for the sake of two calls that overlap
nowhere.

## Commands

Run from the repo root (`pnpm db:*`) or here directly.

| Command | Effect |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | Start or stop the Postgres container (repo-root `docker-compose.local.yml`). |
| `pnpm db:migrate` | `prisma migrate dev` — author and apply a migration. |
| `pnpm db:studio` | Browse the data. |
| `migrate:deploy` | `prisma migrate deploy`, for a non-interactive apply. |
| `generate` | Regenerate the client into `src/generated/`. Runs as part of root `pnpm generate`. |

## The migration image

`Dockerfile` here is the deployed `migrate:deploy` — the one image built from a
package rather than an app, because applying migrations is this package's job and
nothing about it belongs to the API that used to carry it (`docker-compose.yml`
runs it to completion before `server` and `agent` start).

It carries no application code and not even the generated client: migrations need
the schema, `prisma/migrations`, and `prisma.config.ts` — hence `packages/env`'s
source, which that config imports. It is also **not** a `--prod` install, since
the Prisma CLI is a dev dependency and is the whole point of the image.

The one non-obvious line is `pnpm rebuild -r prisma @prisma/engines`. Without
`-r`, `pnpm rebuild` scopes to the working directory's project — the workspace
root — and rebuilds nothing at all, silently: the schema engine is then absent, and
the CLI downloads it on every container start, into a directory the `node` user
cannot write. The failure is a permission error at migrate time, not at build time.

The local dev container is `pgvector/pgvector:pg17` with `agent/agent/agent` on `:5432`,
matching the `DATABASE_URL` in `.env.example`. The extension is created by the
`corpus_and_schedule_topics` migration, and `articles.embedding` is the column that
needs it — written by `apps/ingest`, read by `apps/agent`, and `NOT NULL` in both
directions.

## Prisma 7

Prisma 7 changed enough to be worth stating explicitly — most of what is written
online still describes 6:

- The generator is **`prisma-client`**, not `prisma-client-js`.
- **`output` is required** and lands in `src/generated/`.
- Connection settings live in **`prisma.config.ts`**, not the `datasource` block —
  the block declares only the provider.
- A **driver adapter is mandatory** (`@prisma/adapter-pg`). Everything constructs
  its client through `createPrismaClient(connectionString)`, so the adapter choice
  and its options stay in one place.
- `importFileExtension = ""` — the generated client emits the bare specifiers the
  workspace's `bundler` resolution consumes, `./generated/client` included.
- **`prisma.config.ts` loads the repo-root `.env` itself** — Prisma 7 no longer
  reads `.env` on its own. The value is read through `@personal-agent/env`: the
  `DATABASE_URL` declaration re-wrapped with a local `.default()`, so the name and
  its validation stay shared while only the fallback is this package's. Falling
  back rather than requiring the variable keeps `prisma generate` — which never
  opens a connection — working on a fresh clone; keeping the default *here* keeps
  `apps/server` failing at boot on a missing URL instead of dialling localhost.
- `@prisma/engines` is allowed to build (see `pnpm-workspace.yaml`): it downloads
  the schema engine the CLI shells out to for migrations. It is **CLI-only**,
  since queries now go through the driver adapter.

## Schema

`src/index.ts` is the public surface: `createPrismaClient`, plus `Prisma`,
`PrismaClient` and the model types re-exported from the generated client, so
consumers never reach into `src/generated/` themselves.

`User` is keyed by the Auth0 `sub` itself, with no generated id. It exists so
user-scoped tables reference something real instead of repeating a dangling
string, and the API writes a row the first time it sees a `sub`. It still holds
no profile data — Auth0 owns that — but it is no longer column-free: `locale` and
`theme` are the portal's stored language and theme preferences, so both
follow a reader across devices. Their `"en"` and `"auto"` defaults **duplicate
`DEFAULT_LOCALE` and `DEFAULT_THEME` in `packages/schemas`**, which no
migration can import; both values are validated on read, not by the column, so a
value dropped from `LocaleSchema` or `ThemeSchema` degrades to the default
rather than failing the request. `pnpm seed-schedule` upserts one,
because on a fresh database nothing has called the auth path that would.

**It now also holds where a brief goes**, which is the one place reader identity
and delivery meet: `email` / `emailVerified` (synced once from the Auth0
Management API, since the access token carries only `sub`), `deliveryChannel`
and `telegramChatId`, and the `emailSuspendedAt` / `emailSuspendedReason` pair an
unsubscribe writes. Four notes on the shape:

- **`email` is not unique.** Two Auth0 identities — `auth0|…` and
  `google-oauth2|…` — can legitimately carry the same address, and a constraint
  here would fail the sync rather than the sign-in that caused it.
- **`deliveryChannel` is a plain `String`**, like `locale`, `theme` and
  `edition`: `DeliveryChannelSchema` in `packages/schemas` stays the single source
  of the two values, and both readers parse with `.catch(DEFAULT_DELIVERY_CHANNEL)`
  so a hand-edited row degrades to email rather than dropping a brief.
- **There is no fallback from `telegramChatId` to `TELEGRAM_CHAT_ID`.** A null
  chat id on the Telegram channel is a skipped run, deliberately: falling back to
  the environment would mail one reader's brief into another reader's chat the
  moment there is more than one user.
- **`emailSuspendedAt` is the flag; the reason is a separate column** so a bounce
  or complaint webhook can record a different one later without a migration. Only
  `unsubscribed` is written today, and `emailSuspendedAt` alone decides whether
  delivery stops.

`Schedule` splits into **intent** the owner sets (`cron`, `timezone`, `edition`,
`enabled`) and one column the worker writes (`lastRunAt`). There is deliberately
no `nextRunAt`: croner holds the live jobs in memory, so a stored next-fire time
would be a second source of truth that nothing reads. `lastRunAt` is not
bookkeeping — it is what makes the worker's catch-up pass idempotent across a
restart (see [`apps/agent`](../../apps/agent/CLAUDE.md)). `createdAt` is read by
that same pass: a row cannot have missed an occurrence older than itself, so it
is the floor when `lastRunAt` is still null.

There is no unique constraint across `(userId, edition)` — nothing rules out two
morning briefs at different hours — so **`pnpm seed-schedule` rewrites the row it
finds** rather than relying on the database to reject a second one.

`edition` is a plain `String`, not a Postgres enum, so `EditionSchema` in the
agent stays the single source of truth for the two values and an enum migration is
never needed. The cost is that the constraint lives in the reader: the worker
parses every row and skips one it cannot use.

`Topic` hangs off a **schedule**, not a user — a morning markets brief and an
evening brief on something else are different subscriptions — but it keeps a
`userId` column so owner-scoped queries stay a plain `where` with no join. A
denormalised owner can drift from the schedule's, which would make a row visible
through one query path and invisible through the other, so it is **enforced by a
composite foreign key**: `(schedule_id, user_id)` references
`schedules(id, user_id)`, which is the only reason `Schedule` carries
`@@unique([id, userId])`. Postgres rejects a mismatched pair outright; the API
never has to be trusted to keep the two in step.

`Source` is **identity for the trusted feed list, not the list itself** — the
feeds are a const in `../../apps/ingest/src/feeds/sources.ts`, and the row exists because
`Article.sourceId` is a foreign key that needs something stable to point at.
Ingest upserts one row per feed at boot, keyed on `feedUrl` so an id survives a
rename. That is the whole model: `id`, `name`, `feedUrl` and the timestamps.

The `slim_sources` migration dropped what the code took over — `cron`, `timezone`,
`adapter`, `enabled`, and the `etag`/`lastModified`/`lastPolledAt` a poller used
to keep here so a conditional request survived a restart (they are a map in
`apps/ingest/src/feeds/validators.ts` now). Unlike `Schedule`, this table is not
where a feed is configured, and the columns went rather than being left unread:
one nothing reads is a second copy of the list, free to disagree with the const
that governs. Adding a feed is a code change and a deploy; it needs no row edit,
and there is no seed step.

`Article.embedding` is `Unsupported("halfvec(4000)")`, so **Prisma can store it but
cannot select or filter on it** — similarity search is `$queryRaw` against the
HNSW index (`halfvec_cosine_ops`), which the migration creates by hand because
Prisma cannot express either.

**`@@index([embedding], map: "articles_embedding_idx")` on the model is not a
description of the index that exists** — Prisma has no `Hnsw` index type, so what
the datamodel declares is a btree. It is there because otherwise `migrate dev`
reads an index it cannot express and emits a `DROP INDEX` for it on *every* run;
the diff compares an index's name and columns and never its access method, so a
declared btree of the right name is enough to stop that. **The name in the two
files has to stay in step**, and a `db push` or a datamodel-derived baseline would
build the btree for real — which succeeds on an empty table and then fails on the
first row (`index row size 8016 exceeds btree version 4 maximum 2704`), so neither
is safe here.

`embedding` and `embeddingModel` are both `NOT NULL` because `apps/ingest` embeds
before it inserts — `insertArticles` takes an `EmbeddedArticle`, and a failed
`embedDocuments` aborts the poll rather than storing an unembedded row. Relaxing
either is what a store-now-backfill-later ingest would need; until then a nullable
vector would not be an error, it would be an article silently invisible to half of
the fused ranking — and a vector whose producing model is unrecorded is one the
re-embed below cannot find.

**4000 is not the model's dimension — it is the index's ceiling.**
`qwen/qwen3-embedding-8b` returns 4096, and an HNSW entry has to fit one 8 kB
page: at 4 bytes per dimension `vector` caps out at 2000, at 2 bytes `halfvec`
reaches 4000. So `halfvec` is what buys the extra 2000 dimensions, and 4000 is the
widest embedding pgvector will index at all — a `vector(4096)` column is storable
but can only be sequentially scanned. Qwen3 embeddings are MRL-trained and
OpenRouter honours a `dimensions` request parameter, so ingest asks for 4000 and
gets a truncation the model was built for. **`dimensions` and the column must
agree**; nothing checks it, and a mismatch fails at the first insert.

fp16 is the trade, and cosine ranking does not notice it: the same three probe
texts rank identically at `halfvec(4000)` and `vector(2000)` (0.15 for a
paraphrase, 0.43 for an unrelated story).

The dimension is a schema commitment either way: a different embedding model means
a migration plus a re-embed, which is what `embeddingModel` on the row exists to
make progressive.

**Whether the index earns its keep is a separate question from its width.** On
10k rows the recency-filtered exact scan this corpus actually issues took 11 ms
unindexed — the same as the indexed query — while HNSW cost 35 s to build and
missed two of the true top ten. The index is here for a corpus that outgrows that,
not because the current one needs it.

`ArticleDelivery` records what a schedule has already been sent, so a later brief
can exclude it — written by the worker's delivery step, read as the `NOT EXISTS`
that narrows the retrieval pool.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable. In
  `schema.prisma` this covers `//` and `///` alike.
