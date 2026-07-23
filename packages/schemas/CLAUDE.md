# `@personal-agent/schemas`

The Zod schemas the API contract is made of, shared by `apps/server` (which wraps
them in `createZodDto`) and `apps/client` (which validates against them directly).
**This package is declarative only** — no transport, no framework, no runtime
behaviour beyond parsing. See the [root CLAUDE.md](../../CLAUDE.md) for the
workspace-wide picture.

## Commands

| Command | Effect |
| --- | --- |
| `typecheck` | `tsc --noEmit`. |

## Module resolution

Uses the workspace default — `bundler` resolution, **no import extension, no
build**. `exports` points straight at the TypeScript `src`, which every consumer
compiles just-in-time: `apps/server` via swc-node, `apps/client` via Vite. `tsc`
here only typechecks.

## zod is a peer dependency

Declared as a **peerDependency plus devDependency**, never a plain dependency.
`createZodDto` and `ZodValidationPipe` identify schemas structurally (`'_zod' in
schema`), so a second copy of zod resolved under this package would produce
schemas the API silently fails to validate with. The peer declaration is what
makes pnpm hoist the one copy all three packages share.

## Conventions

- Every schema carries **`.meta({ id: 'Name' })`**, and its type is derived
  beside it with `z.infer`. The id names the schema wherever it is referenced
  from another one — see the naming caveat in
  [apps/server/CLAUDE.md](../../apps/server/CLAUDE.md).
- One schema per file, grouped by domain, re-exported through the folder's
  `index.ts` and reachable as a subpath (`@personal-agent/schemas/topics`).
  Adding a folder means adding an `exports` entry.
- Schemas describe **the wire**, not the database. `Topic.createdAt` is an ISO
  string here and a `Date` in `packages/db`; the API maps between them.

## What lives here

`topics/` is the resource. `auth/` is `AuthenticatedUser` — the body of `GET /me`
and the shape `@CurrentUser()` hands a handler. `health/` is `Health`, whose `db`
is a closed set rather than a probe message, because the route is public and a
driver error names the host, port, database and user.

`common/` is the error contract: `ErrorCode` (the machine-readable reason a
request failed), `ValidationIssue` (a Zod issue flattened to something
JSON-safe), and `ApiError` — the body `apps/server`'s exception filter returns
for **every** failure, and the shape `apps/client`'s fetcher parses.
