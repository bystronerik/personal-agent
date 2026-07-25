# `@personal-agent/db`

Owns the Prisma schema, the migrations, and the generated client. **The only
package that talks to Postgres** — nothing else constructs a Prisma client or
handles a connection string. One workspace dependency: `@personal-agent/env`
(CLI-time, for `DATABASE_URL`); one consumer: `apps/server`. See the
[root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Commands

Run from the repo root (`pnpm db:*`) or here directly.

| Command | Effect |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | Start or stop the Postgres container (repo-root `docker-compose.yml`). |
| `pnpm db:migrate` | `prisma migrate dev` — author and apply a migration. |
| `pnpm db:studio` | Browse the data. |
| `migrate:deploy` | `prisma migrate deploy`, for a non-interactive apply. |
| `generate` | Regenerate the client into `src/generated/`. Runs as part of root `pnpm generate`. |

The container is `pgvector/pgvector:pg17` with `agent/agent/agent` on `:5432`,
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
writes a row the first time it sees a `sub`.
