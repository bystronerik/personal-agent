# @personal-agent/db

The only package that talks to Postgres. It exports `createPrismaClient(connectionString)`
and the generated types from `src/index.ts`. `apps/agent`, `apps/ingest` and
`apps/server` import it. It imports `packages/env` for the CLI config only.

## Scripts

| Script | Effect |
| --- | --- |
| `generate:db` | `prisma generate`. Run it after each change to `schema.prisma` |
| `migrate` | `prisma migrate dev`. Creates and applies a migration in development |
| `migrate:deploy` | `prisma migrate deploy`. Applies pending migrations. The Docker image runs this |
| `studio` | `prisma studio` |
| `build` | `tsc` only |

## Migration workflow

1. Start the database with `pnpm db:up`.
2. Edit `prisma/schema.prisma`.
3. Run `pnpm db:migrate` from the repository root. Prisma writes a folder under
   `prisma/migrations/` and applies it.
4. Run `pnpm generate:db` if a consumer needs the new types now. `build` and `start:dev`
   already depend on that task.

## Models

`users` → `schedules` → `topics` is the reader side. `sources` → `articles` →
`article_deliveries` is the corpus side, where `article_deliveries` joins a schedule to
the articles that it already sent.

## Gotchas

- `src/generated/` is Prisma output. Never edit it, and it is not committed. A fresh
  clone has no client until `generate:db` runs.
- `articles.embedding` is `Unsupported("halfvec(4000)")`. Prisma can create the column
  but it can neither read nor write it. Use raw SQL for that column, and change the width
  in `schema.prisma` and in `OPENROUTER_EMBEDDING_DIMENSIONS` together.
- Some indexes exist only in hand-written migration SQL, for example the full-text index
  in `20260726231500_articles_fulltext_index`. Read the SQL as well as the schema.
- `prisma.config.ts` loads the repository-root `.env` itself, because Prisma 7 does not.
  It also falls back to the local database URL, so `generate` works on a fresh clone.
- Prisma 7 needs a driver adapter. Always create a client through `createPrismaClient`.
