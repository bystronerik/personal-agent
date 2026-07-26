# `@personal-agent/schemas`

The Zod schemas the API contract is made of, shared by `apps/server` (which wraps
them in `createZodDto`) and `apps/client` (which validates against them directly).
**Declarative only** — no transport, no framework, no runtime behaviour beyond
parsing. See the [root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Only one copy of zod may exist

`createZodDto` and `ZodValidationPipe` identify schemas structurally (`'_zod' in
schema`), so a second copy of zod resolved under this package would produce
schemas the API silently fails to validate with — with no error, only routes that
stop validating.

zod is a plain **dependency** here, at the same `^4.4.3` range every consumer
declares, which is what keeps pnpm resolving one version for all of them. A
consumer widening or pinning its own range differently is the thing to watch:
check `pnpm-lock.yaml` has a single `zod@` entry after changing it.

It was a peerDependency filled from a devDependency until the Docker images
needed it — `--prod` drops a devDependency, leaving `packages/env` and this
package with an unresolvable peer and the image with a symlink hack in place of
a dependency.

## Conventions

- Every schema carries **`.meta({ id: 'Name' })`**, and its type is derived beside
  it with `z.infer`. The id names the schema wherever another one references it,
  and downstream in the generated client (root file) — see the rename caveat in
  [apps/server/CLAUDE.md](../../apps/server/CLAUDE.md).
- One schema per file, grouped by domain, re-exported through the folder's
  `index.ts` and reachable as a subpath (`@personal-agent/schemas/topics`).
  Adding a folder means adding an `exports` entry.
- Schemas describe **the wire**, not the database. `Topic.createdAt` is an ISO
  string here and a `Date` in `packages/db`; the API maps between them.
- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.

## What lives here

`topics/` is the resource. `auth/` is `AuthenticatedUser` — the body of `GET /me`
and the shape `@CurrentUser()` hands a handler. `health/` is `Health`, whose `db`
is a closed set rather than a probe message, because the route is public and a
driver error names the host, port, database and user.

`common/` is the error contract: `ErrorCode` (the machine-readable reason a
request failed), `ValidationIssue` (a Zod issue flattened to something
JSON-safe), and `ApiError` — the body `apps/server`'s exception filter returns
for **every** failure, and the shape `apps/client`'s fetcher parses.
