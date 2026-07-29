# Personal Agent

An agentic morning/evening brief assistant. A poller keeps a global corpus of
news articles fresh in Postgres; a scheduled worker wakes up on each reader's cron
schedule, runs a model-driven agent over that corpus, and delivers a brief by
email or Telegram. An admin portal lets a reader manage their schedules, topics
and delivery settings.

Two things shape the design:

- **The model drives control flow.** There is no hardcoded `fetch → summarize →
  predict` pipeline. An orchestrator offers three specialists — research,
  prediction, summary — as tools and decides order, depth and termination itself,
  under a shared USD budget.
- **Predictions are logged experiments.** They are written
  to be machine-checkable and scored against reality later.

## Architecture

```
apps/ingest ──> articles + embeddings ──> Postgres <── apps/agent (brief worker)
                                              ^                 │
                                              │                 └──> email / Telegram
apps/client ──HTTP──> apps/server ────────────┘
```

`apps/ingest` and `apps/agent` are joined by the database, not by an import —
they poll and brief on unrelated schedules and fail independently.

| Workspace | What it is |
| --- | --- |
| [`apps/agent`](apps/agent/CLAUDE.md) | Standalone brief worker: framework-free agent core + eval harness + the scheduled process |
| [`apps/ingest`](apps/ingest/CLAUDE.md) | Corpus poller — trusted feeds → embeddings → Postgres |
| [`apps/server`](apps/server/CLAUDE.md) | NestJS admin API — auth, schedules, topics, preferences |
| [`apps/client`](apps/client/CLAUDE.md) | React + Mantine admin portal (Vite, TanStack Query, Auth0) |
| [`packages/db`](packages/db/CLAUDE.md) | Prisma schema, migrations, generated client — the only package that talks to Postgres |
| [`packages/schemas`](packages/schemas/CLAUDE.md) | Zod schemas the API contract is made of |
| [`packages/env`](packages/env/CLAUDE.md) | Every env variable's name/schema/default + the shared loader |
| [`packages/embedding`](packages/embedding/CLAUDE.md) | OpenRouter embeddings client (query/document asymmetry) |
| [`packages/email`](packages/email/CLAUDE.md) | Resend client for delivery + the unsubscribe token both apps share |
| [`packages/telegram`](packages/telegram/CLAUDE.md) | Bot API client for delivery |

Each workspace has its own `CLAUDE.md` with internals; the
[root `CLAUDE.md`](CLAUDE.md) covers what spans packages.

### Data model

`users` (channel, address, chat id) → `schedules` (cron + timezone + edition) →
`topics`. Separately, `sources` → `articles` (with a pgvector `embedding` column)
→ `article_deliveries`. The corpus is global; personalisation happens at query
time, so two readers interested in the same subject cost one fetch and one
embedding.

## Requirements

- Node >= 24, pnpm 11 (`packageManager` pins the exact version)
- Docker, for local Postgres (`pgvector/pgvector:pg17`)
- Accounts/keys: [OpenRouter](https://openrouter.ai) (chat + embeddings),
  [Auth0](https://auth0.com) (portal + API), and — for delivery —
  [Resend](https://resend.com) and/or a Telegram bot from `@BotFather`

## Local development

```bash
pnpm install
cp .env.example .env   # then fill it in — see below
pnpm db:up             # Postgres on :5432
pnpm db:migrate        # apply migrations
pnpm start             # API :3001, portal :3000, and the brief worker
```

**`pnpm start` starts the worker too, and scheduling costs money.** To run just
the API and portal:

```bash
pnpm start --filter @personal-agent/server --filter @personal-agent/client
```

The corpus poller is deliberately not part of `pnpm start` for the same reason —
embedding costs money. Fill the corpus once with:

```bash
pnpm --filter @personal-agent/ingest ingest --once
```

There is no feed seeding step: the feed list is a const in
`apps/ingest/src/feeds/sources.ts` and upserts its own rows on every boot.

Useful URLs once running: portal at `http://localhost:3000`, Swagger UI at
`http://localhost:3001/docs`, Prisma Studio via `pnpm db:studio`.

### Configuration

**One `.env` at the repo root** (gitignored), never one per package. Every
variable is declared once in `packages/env` and validated with Zod at the
boundary, so a missing or malformed value fails at startup with every problem
reported at once. Blank values in `.env` count as absent and fall through to
defaults.

The essentials: `DATABASE_URL`, `OPENROUTER_API_KEY`, the `AUTH0_*` /
`VITE_AUTH0_*` pair, `RESEND_API_KEY` + `EMAIL_FROM` and/or
`TELEGRAM_BOT_TOKEN`, and `UNSUBSCRIBE_SECRET` (`openssl rand -hex 32`) — which
`apps/server` and `apps/agent` must both be given the *same* value, since one
signs unsubscribe links and the other verifies them. `.env.example` documents the
rest, including the optional ones and their defaults.

`VITE_`-prefixed values are inlined into the browser bundle, so nothing secret
may carry that prefix.

A new variable must also be declared in `turbo.json`, or a cached task is reused
across a changed value.

### Codegen

Nothing generated is committed. Three chained Turbo tasks produce it:
`generate:db` (Prisma client) → `generate:spec` (the server's `openapi.yaml`) →
`generate:api` (orval → the portal's typed hooks). `build` and `start:dev`
already depend on the chain, so you rarely run them by hand — but after an API
contract change, regenerate from the root rather than inside a package.

Names in the OpenAPI document are load-bearing: a schema's `.meta({ id })` names
the generated model file, a route's `operationId` names the generated hook, and
`@ApiTags` names the folder it lands in.

## Commands

Every command below is a root script; Turbo fans it out to the workspaces that
define it.

| Command | Effect |
| --- | --- |
| `pnpm build` | Every deployed artifact, plus the typecheck of every package. **This is the repo's typecheck** — there is no separate `typecheck` script, because every `build` leads with `tsc --noEmit`. |
| `pnpm start` | API, portal and the brief worker |
| `pnpm test` | Vitest (`packages/email`, `packages/embedding`, `packages/telegram`, `apps/agent`, `apps/ingest`) |
| `pnpm lint` / `lint:fix` | Biome |
| `pnpm ingest` | The corpus poller. Long-running; costs money |
| `pnpm eval` | The agent's offline eval harness — free, no key |
| `pnpm eval:models` | The same suites against real models. Costs money |
| `pnpm db:up` / `db:down` / `db:migrate` / `db:studio` | Local Postgres and Prisma |
| `pnpm generate:db` / `generate:spec` / `generate:api` | Codegen steps, individually |

Per-package commands are not root scripts — run them with
`pnpm --filter <package> <script>`:

| Command | Effect |
| --- | --- |
| `pnpm --filter @personal-agent/agent start:dev --once <scheduleId>` | Fire one schedule immediately and exit — the whole delivery path without waiting for a cron hour |
| `pnpm --filter @personal-agent/agent agent` | Orchestrator end-to-end on a synthetic fixture; needs no database |
| `pnpm --filter @personal-agent/agent probe-corpus "<query>"` | What the agent's `search_news` returns for a query — the way to tell a bad brief caused by retrieval from one caused by the prompt |
| `pnpm --filter @personal-agent/agent seed-schedule --cron "0 7 * * *"` | Write a schedule row offline, for a fresh database |
| `pnpm --filter @personal-agent/ingest ingest --once` | Poll every feed once, sweep, exit |
| `pnpm --filter @personal-agent/telegram telegram:chat-id` | Read the chat id of whoever messaged your bot |

Turbo fans a task out only to the workspaces that define it, and says nothing
about the ones it skipped.

## Testing and evals

`pnpm test` is unit tests only — everything offline, no network and no database.
The agent's evals are separate: `pnpm eval` scores the agent's own grading logic
against fixtures for free, and `pnpm eval:models` runs the real models across the
model list. **The eval harness is what justifies a prompt or agent change** — a
score, not a vibe. It reports without asserting today; the failing gate is
deferred until live tool calls make regressions likelier.

Evals need no database: every layer takes a `SourceProvider` and the offline path
passes the in-memory one. `apps/agent/src/config.test.ts` is what stops that
eroding.

## Running the whole stack in Docker

```bash
docker compose up --build
```

Five images — the four apps plus `packages/db`, which runs `prisma migrate
deploy` to completion before `server`, `agent` and `ingest` start. **Every image
builds from the repo root as context**, never from a package directory, because
a workspace-filtered install needs the root lockfile and the sibling manifests.

Server, agent, ingest and migrate read `.env` at runtime; the client cannot —
Vite inlines its config into the bundle, so `VITE_*` values are compose build
`args` and a different Auth0 tenant is a different image. Only public identifiers
belong there.

`docker-compose.local.yml` is a different thing entirely: Postgres alone, what
`pnpm db:up` starts behind a local dev session.
