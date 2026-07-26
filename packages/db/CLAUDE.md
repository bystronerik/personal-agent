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
matching the `DATABASE_URL` in `.env.example`. The image carries pgvector for
intended semantic search, but the schema has no vector column and nothing embeds
anything yet.

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

`User` is **structural** — keyed by the Auth0 `sub` itself, with no generated id
and no other columns. It exists so user-scoped tables reference something real
instead of repeating a dangling string; it holds no profile data, and the API
writes a row the first time it sees a `sub`. `pnpm seed-schedule` upserts one,
because on a fresh database nothing has called the auth path that would.

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

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable. In
  `schema.prisma` this covers `//` and `///` alike.
