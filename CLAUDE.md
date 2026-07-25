# Personal Agent — Morning/Evening Brief

Only what spans packages. Internals live in each workspace's own `CLAUDE.md`.

| Package | What it is |
| --- | --- |
| [`packages/db`](packages/db/CLAUDE.md) | Prisma schema, migrations, generated client |
| [`packages/env`](packages/env/CLAUDE.md) | Every env variable's name/schema/default + the shared loader |
| [`packages/schemas`](packages/schemas/CLAUDE.md) | Zod schemas the API contract is made of |
| [`packages/telegram`](packages/telegram/CLAUDE.md) | Bot API client for brief delivery |
| [`apps/agent`](apps/agent/CLAUDE.md) | Standalone brief worker: framework-free core + eval harness + the scheduled process |
| [`apps/server`](apps/server/CLAUDE.md) | NestJS admin API — auth, config, topics |
| [`apps/client`](apps/client/CLAUDE.md) | React + Mantine admin portal |

## Non-negotiable constraints

- **The model drives control flow.** No hardcoded `fetch → summarize → predict`
  pipeline: a model-driven orchestrator offers the three specialists as tools and
  decides order, depth, and termination. Specialists hand off through a typed
  blackboard, not model-serialized arguments. The loop is `@openrouter/agent`'s
  `callModel`; termination (`stopWhen` over a shared USD budget) stays ours.
- **The agent core imports no caller framework** — no NestJS, HTTP, database, or
  delivery transport. All of that lives in `apps/agent/src/worker/`, the one
  directory that imports `packages/db`, `packages/telegram`, and a scheduler.
- **The schedule is data, not code.** The worker reads cron rows from Postgres and
  reconciles its live jobs against them on a timer, so changing when a brief
  arrives is a row edit, not a deploy.
- **Predictions are logged experiments, never financial advice** — machine-checkable,
  scored against reality later.
- **The eval harness justifies prompt/agent changes** with a score, not a vibe.
  (`pnpm eval` reports without asserting; the failing gate is deferred until live
  tool calls make regressions likelier.)

## How the packages relate

```
apps/client ──(orval codegen from apps/server openapi.yaml)──> apps/server ──┐
     └──────────────> packages/schemas <──────────────┘                      ├──> packages/db ──> Postgres
apps/agent (top-of-graph scheduled worker) ──> packages/telegram             ─┘
```

Every workspace dependency is one-directional:

- **`packages/db` is the only package that talks to Postgres** — nothing else
  constructs a Prisma client or a connection string. Two consumers: `apps/server`,
  and `apps/agent`'s worker (never its core). They share the client factory and
  the schema, not query code.
- **`packages/schemas` defines the API contract** — `apps/server` wraps its schemas
  in `createZodDto` and derives OpenAPI from them; `apps/client` parses the same
  objects to validate a form before it becomes a request. Depends on nothing.
- **`packages/env` is the single home for environment loading.** All five other
  workspaces depend on it; it depends on nothing but `zod`. The browser reaches it
  **only** through the `@personal-agent/env/client` subpath, which never imports the
  server registry — so a server variable cannot land in the client bundle.
- **`apps/client` depends on `apps/server` as a devDependency only**, so
  `apps/server/src/generated/openapi.yaml` can feed orval codegen. No runtime import
  crosses that boundary — they share `packages/schemas` and talk over HTTP, so a
  breaking API change fails the UI typecheck rather than at runtime.
- **`apps/agent` is top-of-graph** — nothing imports it, so `typecheck` catches
  the ESM mistakes a build would. It depends on `packages/db` and
  `packages/telegram` from `src/worker/` only; **rows are seeded by hand until an
  admin API owns them**, so nothing yet writes a schedule over HTTP.

Nothing is compiled ahead of time; the ordering that matters is codegen. `pnpm
generate` runs Prisma `generate` → the server's `openapi` emit → orval, and
`typecheck`/`build`/`dev` all depend on it, so generated code is never stale.
**Nothing generated is committed.**

## Commands

Every command is a root script; Turbo fans it out to the workspaces that define it.

| Command | Effect |
| --- | --- |
| `pnpm generate` | Prisma client, OpenAPI document, portal's typed client. |
| `pnpm build` | The one compiled artifact — the client's Vite bundle. |
| `pnpm typecheck` / `pnpm lint` | tsc, and Biome (`lint:fix` writes). |
| `pnpm test` | Vitest (`packages/telegram`, `apps/agent`). |
| `pnpm worker` | The scheduled brief worker. Long-running; needs Postgres. |

Per-app commands (`eval`/`eval:*`, `agent`, `worker --once`, `seed-schedule`,
`dev`, `telegram:*`, `db:*`) live in their package's `CLAUDE.md`. `pnpm dev`
deliberately does **not** start the worker — scheduling costs money, so it is its
own command.

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
- **One module system, no build step for internal code.** Every package is ESM with
  `moduleResolution: bundler` (`tsconfig.base.json`), so **relative imports carry no
  extension, anywhere.** Internal packages export their TypeScript `src` (`"exports"`
  points at `.ts`, no `dist`); consumers compile just-in-time — Vite for
  `apps/client`, `tsx` for the agent/telegram CLIs, `@swc-node/register` for
  `apps/server`. `tsc` only typechecks (`--noEmit`). The one compiled artifact is the
  client's `vite build` bundle.
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
- **Comments are rare and code-focused** — only to summarise complex logic or a
  non-obvious contract, never to narrate design or history (that lives in these
  `CLAUDE.md` files and git). A variable needing an explanatory comment usually
  needs a better name.

## Working agreement

- Project notes live in these `CLAUDE.md` files — never in Claude's memory directory.
- **Ask before making changes.**
