# Personal Agent — Morning/Evening Brief

This root file carries only what spans packages: the constraints, how the
packages relate, cross-cutting patterns, and shared conventions. Package
internals live in each workspace's own `CLAUDE.md`; keep this file limited to
what more than one package needs.

| Package | What it is |
| --- | --- |
| [`packages/db`](packages/db/CLAUDE.md) | Prisma schema, migrations, generated client |
| [`packages/env`](packages/env/CLAUDE.md) | Every env variable's name/schema/default + the shared loader |
| [`packages/schemas`](packages/schemas/CLAUDE.md) | Zod schemas the API contract is made of |
| [`packages/telegram`](packages/telegram/CLAUDE.md) | Bot API client for brief delivery |
| [`apps/agent`](apps/agent/CLAUDE.md) | Standalone brief worker (cron): framework-free core + eval harness |
| [`apps/server`](apps/server/CLAUDE.md) | NestJS admin API — auth, config, topics |
| [`apps/client`](apps/client/CLAUDE.md) | React + Mantine admin portal |

## Non-negotiable constraints

- **The model drives control flow.** No hardcoded `fetch → summarize → predict`
  pipeline: a model-driven orchestrator offers the three specialists as tools and
  decides order, depth, and termination. Specialists hand off through a typed
  blackboard, not model-serialized arguments. The loop is `@openrouter/agent`'s
  `callModel`; termination (`stopWhen` over a shared USD budget) stays ours.
- **The agent core imports no caller framework.** Inside `apps/agent`, the core
  (`agent/`, `schema/`, `tools/`, `grading/`, `eval/`) stays free of NestJS, HTTP,
  and the delivery transport; only the worker's thin wiring layer imports
  `packages/telegram`. Direction is `apps/agent → packages/*`, never the reverse.
- **Predictions are logged experiments, never financial advice** — each is
  machine-checkable and scored against reality later.
- **The eval harness justifies prompt/agent changes** with a score, not a vibe.
  (`pnpm eval` currently reports without asserting — the failing gate is deferred
  until live tool calls make regressions likelier.)

## Stack

TypeScript (ESM, Turborepo, pnpm, Vite, SWC) · OpenRouter chat completions · Prisma 7
on PostgreSQL (`pgvector/pgvector:pg17` via docker-compose) · Telegram delivery
(grammY) · NestJS + OpenAPI + Auth0 + React + Mantine for the admin portal.

The Postgres image carries pgvector, but nothing embeds anything yet — semantic
search (to replace the keyword `search_news`) is unbuilt.

## How the packages relate

```
apps/client ──(orval codegen from apps/server openapi.yaml)──> apps/server ──> packages/db ──> Postgres
     └──────────────> packages/schemas <──────────────┘
apps/agent  (top-of-graph cron worker)      packages/telegram  (delivery; wiring is future work)
```

Every workspace dependency is one-directional:

- **`packages/db` is the only package that talks to Postgres** — nothing else
  constructs a Prisma client or a connection string. Its one consumer is `apps/server`.
- **`packages/schemas` is where the API contract is defined.** `apps/server` wraps
  its schemas in `createZodDto` and derives OpenAPI from them; `apps/client` parses
  the same objects to validate a form before it becomes a request. It depends on nothing.
- **`packages/env` is the single home for environment loading** — the `blankAsAbsent`
  rule, the `loadEnv` validator, and every variable's name/schema/default. All five
  consumers depend on it (`apps/server`, `packages/db`, `packages/telegram`,
  `apps/agent`, and `apps/client`); it depends on nothing but `zod`. The browser
  reaches it **only** through the `@personal-agent/env/client` subpath, which
  re-exports the loader plus the `VITE_*` variables and never imports the server
  registry — so a server variable cannot land in the client bundle even by mistake.
- **`apps/client` depends on `apps/server` as a devDependency only**, purely so
  `apps/server/src/generated/openapi.yaml` can feed orval codegen. No runtime import
  crosses that boundary — they share `packages/schemas` and talk over HTTP, so a
  breaking API change surfaces as a UI typecheck failure rather than at runtime.
- **`apps/agent` is top-of-graph:** nothing imports it; it already depends on
  `packages/env`, and will depend on `packages/telegram` (and later `packages/db`).
  Delivery wiring is future work.

Nothing is compiled ahead of time; the ordering that matters is codegen. `pnpm
generate` runs Prisma `generate` (`packages/db`) → the server's `openapi` emit
(`apps/server`, via swc-node) → orval for `apps/client`, and
`typecheck`/`build`/`dev` all depend on it, so generated code is never stale.
**Nothing generated is committed** — the Prisma client, OpenAPI document, and
portal's typed client are all regenerated.

## Commands

Every command is a root script; Turbo fans it out to the workspaces that define it.

| Command | Effect |
| --- | --- |
| `pnpm generate` | Prisma client, OpenAPI document, portal's typed client. |
| `pnpm build` | The one compiled artifact — the client's Vite bundle. Internal packages have no build. |
| `pnpm typecheck` / `pnpm lint` | tsc, and Biome (`lint:fix` writes). |
| `pnpm test` | Vitest (`packages/telegram`, `apps/agent`). |

Per-app commands (`eval`/`eval:*`, `agent`, `dev`, `telegram:*`, `db:*`) live in
their package's `CLAUDE.md`.

## Cross-cutting patterns

- **One `.env` at the repo root** (gitignored; see `.env.example`), never one per
  package — each package loads it explicitly, and the mechanism differs by runtime
  (`tsx --env-file-if-exists` for CLIs, `envDir: '../..'` for Vite, a pathed
  `dotenv` for `apps/server` and `packages/db`). A new variable must also be
  declared in `turbo.json`, or a cached task is reused across a changed value.
- **Env is Zod-validated at the boundary, and a blank is absent.** Every variable's
  name, schema, and default is declared once in `packages/env`; each consumer selects
  the fields it needs and validates them through the shared `loadEnv`, which reports
  all problems at once keyed by the real variable name. `.env` carries empty
  placeholders (`API_PORT=`), so `blankAsAbsent` (also there, the single copy) lets a
  blank reach `.default()` as `undefined` rather than a valid empty string. `apps/agent`
  reads its two optional scalars with a thin `readEnv` that routes through the same
  `blankAsAbsent`.
- **One module system, no build step for internal code.** Every package is ESM
  (`"type": "module"`) and resolved with `moduleResolution: bundler`
  (`tsconfig.base.json`), so **relative imports carry no extension, anywhere.**
  Internal packages export their TypeScript `src` directly (`"exports"` points at
  `.ts`, there is no `dist`); each consumer compiles it just-in-time — Vite for
  `apps/client`, `tsx` for the agent/telegram CLIs, `@swc-node/register` for
  `apps/server`. `tsc` only ever typechecks (`--noEmit`). The Prisma generator is set
  `importFileExtension = ""` for the same reason. The one compiled artifact in the
  repo is the client's `vite build` bundle.
- **Zod schemas are the source of truth**; types are derived with `z.infer`, never
  hand-written. The same schema reaches the wire both ways — `apps/server` derives
  OpenAPI (nestjs-zod), `apps/agent` derives its `response_format` JSON Schema
  (`toJSONSchema`) — which is why the contract lives in `packages/schemas`.

## Conventions

- **DRY over ceremony** — extract a shared interface or helper rather than
  duplicating; ask before pulling in a new external framework.
- **Comments are rare and code-focused** — only to summarise complex logic or a
  non-obvious contract, never to narrate design or history (that lives in these
  `CLAUDE.md` files and git). A variable needing an explanatory comment usually
  needs a better name.
- **Internal code runs as TypeScript, unbuilt** — `tsx` for the agent/telegram
  CLIs, `@swc-node/register` for the NestJS server (Nest's DI needs the decorator
  metadata that `tsx`/esbuild don't emit but SWC does). `tsc` is typecheck-only
  (`--noEmit`) everywhere.
- Formatting and linting are Biome's (`biome.json`), enforced on staged files by a
  Husky pre-commit hook.

## Working agreement

- Project notes live in these `CLAUDE.md` files — never in Claude's memory
  directory.
- **Ask before making changes.**
