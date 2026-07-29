# Personal Agent

## What the project does

Personal Agent delivers a morning or evening news brief. `apps/ingest` polls trusted RSS
feeds, embeds each new article, and stores it in Postgres. This corpus is global: it
holds the articles for all readers together. `apps/agent` runs a worker that fires on
each reader's cron schedule, runs a model-driven agent over the corpus, and sends the
brief by email or Telegram. The model controls the sequence: an orchestrator offers
research, prediction and summary as tools, and it stops when a shared USD budget runs
out. `apps/server` and `apps/client` are the admin API and the portal, where a reader
manages schedules, topics and delivery settings. The two halves share only the database.

## Workspaces

| Workspace | Purpose |
| --- | --- |
| `apps/agent` | Agent core, eval harness and the scheduled brief worker |
| `apps/client` | React and Mantine admin portal (Vite, TanStack Query, Auth0) |
| `apps/ingest` | Feed poller. Writes articles and embeddings to Postgres |
| `apps/server` | NestJS admin API. Auth0 JWT, schedules, topics, preferences |
| `packages/db` | Prisma schema, migrations and the generated client |
| `packages/email` | Resend send client and the unsubscribe token |
| `packages/embedding` | OpenRouter embeddings client |
| `packages/env` | Declaration and validation of each environment variable |
| `packages/schemas` | Zod schemas that make the API contract |
| `packages/telegram` | Telegram Bot API send client |

The dependency direction is one way. Apps import packages. Packages do not import apps.
`env`, `schemas` and `embedding` import no workspace package. `db`, `email` and
`telegram` import `env`. `apps/agent` imports all six packages; `apps/ingest` imports db,
embedding and env; `apps/server` imports db, email, env and schemas; `apps/client`
imports env and schemas, and it also reads the OpenAPI file of `apps/server`.

## Tooling

Node 24 or later is necessary. The package manager is pnpm 11.15.1, pinned in
`packageManager`. The pnpm workspaces are `apps/*` and `packages/*`. Turborepo fans each
root script out to the workspaces that declare it, and it tells you nothing about the
workspaces that it skipped. Biome 2.3.11 does the lint and the format. Husky runs
`lint:staged:fix` before each commit, and it re-stages only the files that were staged.
Each workspace `tsconfig.json` extends `tsconfig.base.json`, which sets `strict` and
`noUncheckedIndexedAccess`. All packages set `noEmit: true`.

## Commands

Run these commands from the repository root.

| Command | When to use it |
| --- | --- |
| `pnpm build` | Build all artifacts. Each build starts with `tsc`, thus this is also the repository typecheck |
| `pnpm test` | Run the Vitest unit tests. They need no network and no database |
| `pnpm lint` / `pnpm lint:fix` | Check or correct the style with Biome |
| `pnpm start` (or `pnpm start:dev`) | Start the API, the portal and the brief worker. The worker sends paid briefs |
| `pnpm db:up` / `pnpm db:down` | Start or stop the local Postgres container |
| `pnpm db:migrate` | Apply the migrations. Start the database first |
| `pnpm db:studio` | Open Prisma Studio to examine the rows |
| `pnpm ingest` | Poll the feeds continuously. This calls a paid embedding model |
| `pnpm eval` | Score the agent grading logic against fixtures. Free and offline |
| `pnpm eval:models` | Run the same suites against real models. This costs money |
| `pnpm generate:db` | Generate the Prisma client after a change to `schema.prisma` |
| `pnpm generate:spec` | Emit the server OpenAPI file after a change to the API contract |
| `pnpm generate:api` | Generate the typed hooks of the portal from that OpenAPI file |

`turbo.json` chains the three `generate:*` tasks, and `build` and `start:dev` depend on
them. Run them by hand only to see the result of a contract change.

A script that is not in the root `package.json` is a per-workspace script. Run it with
`pnpm --filter <package> <script>`, for example
`pnpm --filter @personal-agent/agent probe-corpus "rate decision"`.

## Local infrastructure

`docker-compose.local.yml` starts one service: Postgres with pgvector. `pnpm db:up`
starts it. Use it for all local development. **Start the database before you run the
migrations, the server, the worker or the ingest job.**

`docker-compose.yml` is different. It builds and runs the full stack: Postgres, a
`migrate` job from `packages/db`, and the four apps. Use it to test the deployed shape.
Each image builds with the repository root as the Docker context.

## Environment

There is one `.env` file, at the repository root. It is gitignored. `.env.example` lists
each variable with its purpose and its default. Copy that file and fill it in.
`packages/env` declares each variable one time, with its real name and a Zod schema.
`loadEnv()` reads the values, treats a blank value as absent, and reports all problems in
one message. Each app has a `config.ts` that selects the variables that it needs.

Do not put a secret behind the `VITE_` prefix. Vite writes those values into the browser
bundle. When you add a variable, add its name to the related task in `turbo.json`. If you
do not, Turbo reuses a cached result after the value changes.

## Conventions

- A commit message is `type: subject`, with a lowercase subject and no body. The types in
  use are `feat`, `chore` and `refactor`.
- Biome formats with 2 spaces, 80 columns, single quotes, no semicolons and trailing
  commas. It sorts imports into groups: Node builtins, external packages,
  `@personal-agent/**`, then relative paths. `noExplicitAny` and `noUnusedVariables` are
  errors.
- Do not write comments. There are two exceptions: a non-obvious contract that a caller
  would break without the comment, and logic that is genuinely dense. Never write a
  comment that restates the next line. `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
- Tests use Vitest. A test file is adjacent to the file that it tests, as
  `<name>.test.ts`. Tests stay offline: they use an injected `fetch` implementation or an
  in-memory provider in place of a real service.
- No generated file is committed. See `.gitignore`.
