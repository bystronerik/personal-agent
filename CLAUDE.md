# Personal Agent — Morning/Evening Brief

Only what spans packages. Internals live in each workspace's own `CLAUDE.md`.

| Package | What it is |
| --- | --- |
| [`packages/db`](packages/db/CLAUDE.md) | Prisma schema, migrations, generated client |
| [`packages/embedding`](packages/embedding/CLAUDE.md) | The OpenRouter embeddings client, and the query/document asymmetry |
| [`packages/env`](packages/env/CLAUDE.md) | Every env variable's name/schema/default + the shared loader |
| [`packages/schemas`](packages/schemas/CLAUDE.md) | Zod schemas the API contract is made of |
| [`packages/telegram`](packages/telegram/CLAUDE.md) | Bot API client for brief delivery |
| [`apps/agent`](apps/agent/CLAUDE.md) | Standalone brief worker: framework-free core + eval harness + the scheduled process |
| [`apps/ingest`](apps/ingest/CLAUDE.md) | Corpus poller — trusted feeds → embeddings → Postgres |
| [`apps/server`](apps/server/CLAUDE.md) | NestJS admin API — auth, config, topics |
| [`apps/client`](apps/client/CLAUDE.md) | React + Mantine admin portal |

## Non-negotiable constraints

- **The model drives control flow.** No hardcoded `fetch → summarize → predict`
  pipeline: a model-driven orchestrator offers the three specialists as tools and
  decides order, depth, and termination. Specialists hand off through a typed
  blackboard, not model-serialized arguments. The loop is `@openrouter/agent`'s
  `callModel`; termination (`stopWhen` over a shared USD budget) stays ours.
- **The agent core imports no caller framework** — no NestJS, HTTP, or delivery
  transport; those live in `apps/agent/src/worker/`. **The database is the
  exception, and a deliberate one:** retrieval is the agent's own job, so
  `apps/agent/src/sources/corpus.ts` reads Postgres directly. What that costs is
  that "an eval needs no database" is no longer structural — it holds because
  every layer takes a `SourceProvider` and the offline path passes the in-memory
  one. `apps/agent/src/config.test.ts` is what stops that eroding.
- **The schedule is data, not code — the feed list is code.** The brief worker
  reads cron rows from `schedules` and reconciles its live jobs against the table
  on a timer, so changing when a brief arrives is a row edit rather than a deploy.
  `apps/ingest` is the deliberate opposite: its feeds are a const in
  `apps/ingest/src/feeds/sources.ts`, arm once at boot, and change by deploy. A reader
  edits their own schedule; nobody but us edits the trusted feed list, and making
  it code buys review, a typecheck, and a fresh clone that ingests with no seeding
  step. It still writes a `sources` row per feed, because `articles.source_id` is
  a foreign key — the row is identity, not configuration.
- **The corpus is global; personalisation is at query time.** `apps/ingest` writes
  one `articles` row per story for every reader; a schedule's `topics` steer what
  its brief searches for. Two readers interested in the same subject cost one
  fetch and one embedding.
- **Predictions are logged experiments, never financial advice** — machine-checkable,
  scored against reality later.
- **The eval harness justifies prompt/agent changes** with a score, not a vibe.
  (`pnpm eval` reports without asserting; the failing gate is deferred until live
  tool calls make regressions likelier.)

## How the packages relate

```
apps/client ──(orval codegen from apps/server openapi.yaml)──> apps/server ──┐
     └──────────────> packages/schemas <──────────────┘                      ├──> packages/db ──> Postgres
apps/agent (top-of-graph scheduled worker) ──> packages/telegram             ─┤
apps/agent ──> packages/schemas (Edition alone — the schedules API writes it) ─┤
apps/ingest (top-of-graph corpus poller)                                     ─┤
apps/agent, apps/ingest ──> packages/embedding                               ─┘
```

**`apps/agent` and `apps/ingest` are joined by the database, not by an import.**
Ingest writes `articles`; the agent reads them. Neither names the other, which is
what lets them poll and brief on unrelated schedules and fail independently.

Every workspace dependency is one-directional:

- **`packages/db` is the only package that talks to Postgres** — nothing else
  constructs a Prisma client or a connection string. Three consumers now:
  `apps/server`, `apps/agent` (its `src/db.ts`, reached by both the worker and the
  corpus provider), and `apps/ingest`. They share the client factory and the
  schema, not query code — and the two apps that touch `articles` go through raw
  SQL, because `embedding` is an `Unsupported` column Prisma can create but
  neither write nor read.
- **`packages/schemas` defines the API contract** — `apps/server` wraps its schemas
  in `createZodDto` and derives OpenAPI from them; `apps/client` parses the same
  objects to validate a form before it becomes a request. Depends on nothing but
  `zod` — which every consumer must resolve to the *same* copy, or schemas stop
  validating silently (see [packages/schemas](packages/schemas/CLAUDE.md)).
  **`apps/agent` is the third consumer, for `EditionSchema` alone**: the admin API
  writes the `edition` column and the worker parses it, so a value one side admits
  and the other rejects is a schedule that never fires.
- **`packages/env` is the single home for environment loading.** All five other
  workspaces depend on it; it depends on nothing but `zod`. The browser reaches it
  **only** through the `@personal-agent/env/client` subpath, which never imports the
  server registry — so a server variable cannot land in the client bundle.
- **`apps/client` depends on `apps/server` as a devDependency only**, so
  `apps/server/src/generated/openapi.yaml` can feed orval codegen. No runtime import
  crosses that boundary — they share `packages/schemas` and talk over HTTP, so a
  breaking API change fails the UI typecheck rather than at runtime.
- **`packages/embedding` owns one contract with two halves.** A document is
  embedded as plain text; a query is wrapped in a retrieval instruction. Those
  halves are applied by different apps — `apps/ingest` writes, `apps/agent` reads
  — and getting them out of step degrades retrieval with no error, so they live in
  one module and are exposed as two functions (`embedDocuments`, `embedQuery`)
  rather than one with a flag.
- **`apps/agent` and `apps/ingest` are both top-of-graph** — nothing imports
  either, so their own `build` (`tsc && rolldown`) is what catches the ESM and
  type mistakes a consumer otherwise would. **A reader now writes their own
  schedules over HTTP** — `apps/client` drives the `schedules` routes, and
  `pnpm seed-schedule` is the offline path that remains for a fresh database.
  Feeds need no seeding at all — `apps/ingest` upserts its own rows from
  the static list on every boot.

Nothing is compiled ahead of time; the ordering that matters is codegen, and it
is expressed as three separate Turbo tasks rather than one: `generate:db`
(Prisma client) → `generate:spec` (the server's OpenAPI emit) → `generate:api`
(orval). `build` and `start:dev` both declare `["^generate:db",
"^generate:spec", "generate:api"]`, so generated code is never stale and no task
depends on codegen it does not use. **Nothing generated is committed.**

The chain is also expressed *between* the tasks, and it has to be: every codegen
input here is generated and gitignored, so it can never be part of the consuming
task's input hash. `generate:spec` declares `^generate:db` (the emit boots the
Nest app, which reaches the Prisma client) and `generate:api` declares
`@personal-agent/server#generate:spec`. Miss either edge and the task is a cache
hit against a stale input — a **FULL TURBO that regenerates nothing** after a
contract change, which fails later as a type error in `apps/client` or not at all.

## Commands

Every command is a root script; Turbo fans it out to the workspaces that define it.

| Command | Effect |
| --- | --- |
| `pnpm build` | Every deployed artifact — `apps/client`'s Vite bundle, `apps/server`'s, `apps/agent`'s and `apps/ingest`'s rolldown bundles — plus the typecheck of every package that has a `build`. Codegen runs first. |
| `pnpm start` | Every long-running process at once: API, portal, **and the worker**. |
| `pnpm generate:db` / `generate:spec` / `generate:api` | Prisma client, OpenAPI document, portal's typed client — individually; `build` and `start:dev` already chain them. |
| `pnpm lint` | Biome (`lint:fix` writes; `lint:staged*` for the hook). |
| `pnpm test` | Vitest (`packages/embedding`, `packages/telegram`, `apps/agent`, `apps/ingest`). |
| `pnpm ingest` | The corpus poller. Long-running; costs money, so it is not part of `pnpm start`. |
| `pnpm eval` / `pnpm eval:models` | The agent's eval harness — the second one costs money. |
| `pnpm db:up` / `db:down` / `db:migrate` / `db:studio` | Local Postgres and Prisma; `db:up`/`db:down` use `docker-compose.local.yml`, the database alone. |

**There is no root `typecheck` script, and no Turbo task by that name.** A
package defines `build`: bundlers do not typecheck — rolldown and Vite alike strip
types with oxc and never check them — so every `build` leads with `tsc`, which
emits nothing because each tsconfig sets `noEmit`. For every package under
`packages/`, that `tsc` *is* the whole build — nothing bundles them, so
typechecking is the only thing their `build` has to do. So
**`pnpm build` is the repo's typecheck**, and CI needs nothing else.

Turbo fans a task out only to the workspaces that define it and says nothing
about the ones it skipped. The same silence is why a Dockerfile calling a script
that has since been renamed or folded away fails at image-build time rather than
in review.

**`pnpm start` starts the worker too** — `apps/agent`'s `start:dev` is
`src/worker/main.ts`, so a dev session now schedules briefs, and scheduling
costs money. Run the API and portal alone with `--filter` when that is not what
you want.

The remaining per-app commands are **not** root scripts: `agent`,
`seed-schedule`, `eval:watch`, `telegram:*` and `start:prod` run through
`pnpm --filter <package> <script>` or from the package directory, and are
documented in that package's `CLAUDE.md`.

## Images and compose

**Five images, and every one of them builds from the repo root as context** —
`docker build -f apps/server/Dockerfile .`, never from the package directory.
The lockfile, `pnpm-workspace.yaml` and the sibling manifests a `--filter
<pkg>...` install needs all live at the root, so a package-scoped context cannot
resolve a workspace dependency. The root `.dockerignore` is what keeps that wide
context cheap and safe: it drops `node_modules`, every `src/generated` tree, and
`.env`.

Four of the five are the deployed apps. **The fifth is `packages/db`** —
`prisma migrate deploy` and nothing else, the only image built from a package
rather than an app, because applying migrations belongs to the package that owns
the schema. `docker-compose.yml` runs it to completion (`depends_on:
service_completed_successfully`) before `server`, `agent` and `ingest` start, so
none ever queries a schema that has not been migrated. Its internals — why it carries
no application code, and why the `pnpm rebuild -r` line is load-bearing — are in
[packages/db](packages/db/CLAUDE.md).

Two compose files, and they are not variants of each other:
`docker-compose.local.yml` is Postgres alone, what `pnpm db:up` starts behind a
local dev session; `docker-compose.yml` is the whole stack — postgres, migrate,
server, client, agent, ingest. Both take `POSTGRES_*` from the root `.env` with
`agent` as the default.

**The client's configuration is build-time, everything else's is runtime.**
Server, agent, ingest and migrate read `.env` values as compose `environment`; the
client cannot, because Vite inlines every `VITE_*` value into the bundle — so
they are compose build `args`, and a different Auth0 tenant or API origin is a
different image. Only public identifiers may go there: a build argument is
readable in the image history, and the bundle is public anyway.

## Cross-cutting patterns

- **One `.env` at the repo root** (gitignored; see `.env.example`), never one per
  package — each loads it explicitly, by runtime: `tsx --env-file-if-exists` for
  CLIs, `envDir: '../..'` for Vite, a pathed `dotenv` for `apps/server` and
  `packages/db`. A new variable must also be declared in `turbo.json`, or a cached
  task is reused across a changed value.
- **Env is Zod-validated at the boundary, and a blank is absent.** Every variable is
  declared once in `packages/env` — no exceptions; consumers select the fields they
  need in a `<workspace>/src/config.ts` exporting
  `load<Subject>Config(source = process.env)`, and validate through the shared
  `loadEnv`, which reports all problems at once keyed by the real
  variable name. `.env` carries empty placeholders (`API_PORT=`), so `blankAsAbsent`
  lets a blank reach `.default()` as `undefined`. **Vite inlines every prefixed key
  it copies into the bundle it builds, so nothing secret may carry such a prefix.**
- **One module system, and internal packages are never built.** Every package is ESM
  with `moduleResolution: bundler` (`tsconfig.base.json`), so **relative imports carry
  no extension, anywhere.** Internal packages export their TypeScript `src`
  (`"exports"` points at `.ts`, no `dist`) and nothing compiles them on their own —
  a consumer either runs them just-in-time (`tsx` for the agent/telegram CLIs) or
  **bundles them in** (Vite for `apps/client`, rolldown for `apps/server` and
  `apps/agent`). `tsc` only typechecks (`--noEmit`).
  Extensionless imports are why a consumer must be a bundler or a JIT compiler and
  never plain `tsc` emit, which would leave `dist` unrunnable under node.
- **All four deployed apps are bundles**, so none of their images carries source
  or a compiler (the migration image is the exception, and carries neither
  application code nor a bundle — see above).
  `apps/client` runs `vite build`; `apps/server`, `apps/agent` and `apps/ingest`
  run **rolldown directly** — Vite 8 *is* rolldown (it is a direct dependency, and
  rollup is gone), so this is the same engine without the web-app layer a backend
  has no use for. In `apps/agent` it also keeps the build off `vite.config.ts`,
  which in that package belongs to the eval harness.
  **`nest build` cannot replace this in `apps/server`** even though it is a Nest
  app: its default builder is plain `tsc`, which does not bundle, so the emitted
  `dist` would resolve `@personal-agent/*` to raw TypeScript at runtime and carry
  extensionless relative imports Node ESM cannot resolve. It is a repo-wide
  module-resolution change, not a script swap.
  Bundling flattens the dependency graph, so **an app must declare what its bundle
  imports** even when it reaches it through a workspace package: `apps/server`,
  `apps/agent` and `apps/ingest` all depend on `@prisma/adapter-pg` directly because
  `packages/db` is inlined into them, `apps/agent` on `grammy` for
  `packages/telegram`, and `apps/agent` and `apps/ingest` on `@openrouter/sdk` for
  `packages/embedding`.
  **A bundler's `external` predicate is consulted twice per import** — once with
  the written specifier, once with the resolved absolute path — so a predicate
  that forgets the absolute case externalises everything and still exits 0,
  emitting an entry that imports the source tree it was meant to inline.
- **Zod schemas are the source of truth**; types are derived with `z.infer`, never
  hand-written. The same schema reaches the wire both ways — `apps/server` derives
  OpenAPI (nestjs-zod), `apps/agent` its `response_format` JSON Schema
  (`toJSONSchema`) — which is why the contract lives in `packages/schemas`.
- **The OpenAPI document is `apps/client`'s codegen contract, and names in it are
  load-bearing.** A schema's `.meta({ id })` names the component and so the
  generated model file; a route's `operationId` names the generated hook;
  `@ApiTags` names the folder it lands in. Renaming any of the three renames
  something in `apps/client`.

## Conventions

- **DRY over ceremony** — extract a shared interface or helper rather than
  duplicating; ask before pulling in a new external framework.
- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.

## Working agreement

- Project notes live in these `CLAUDE.md` files — never in Claude's memory directory.
- **Ask before making changes.**
