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

## Two schemas that break the `.meta({ id })` rule, and why

`schedules/` carries the only exceptions, both in `EditionSchema`'s neighbourhood:

- **`EditionSchema` has no id.** `apps/agent` shares it — the API writes the
  `edition` column, the worker parses it — and feeds its schemas to
  `z.toJSONSchema` for structured outputs. An id makes zod emit `$ref` into
  `$defs`, which strict mode rejects and the agent's `stripUnsupported` does not
  flatten. The id is applied where the API uses it (`ScheduleSchema`), so the
  component is still named `Edition` and the agent still gets the enum inline.
  `apps/agent/src/llm/json-schema.test.ts` is what stops that regressing.
- **`CronExpressionSchema` and `TimeZoneSchema` have none either**, being field
  validators rather than components; an id would put a bare string in the document
  as a schema of its own.

`CronExpressionSchema` is also the one schema here whose contract is
**one-directional**: it accepts a deliberate subset of what croner parses (five
fields, `* , - /`, numeric or named values — no seconds field, `L`, `W`, `#`, `+`,
`?` or `@daily`). This package may not depend on croner, so the property that
matters — *everything this accepts, croner can fire* — is pinned by a test in
`apps/agent`, the only workspace holding both. `apps/server` re-checks with croner
before writing, so drift costs a rejected request rather than a schedule that
silently never runs.

## What lives here

`topics/` is the resource. `schedules/` is the resource that owns it — `Schedule`
(with its topics embedded, and a `nextRunAt` the API computes rather than stores),
`CreateSchedule`, `UpdateSchedule`, and `MAX_SCHEDULES_PER_USER`, which is here
rather than in `apps/server` so the portal can stop at the cap instead of
discovering it from a 409. `auth/` is `AuthenticatedUser` — the body of `GET /me`
and the shape `@CurrentUser()` hands a handler. `users/` is `UserPreferences`,
the body of `GET`/`PATCH /me/preferences`: **separate from `auth/` on purpose**,
because `AuthenticatedUser` is derived from the access token on every request
while a preference is a database read, and folding one into the other would put
a query on the auth path. Its `Locale` is a **closed enum** rather than a BCP-47
string, so `apps/client` can derive its supported languages from
`LocaleSchema.options` instead of keeping a second list; `DEFAULT_LOCALE` beside
it mirrors the column default in `packages/db`. `Theme` is the same shape
for the portal's theme, and its members are **Mantine's own `light | dark |
auto`** — the portal hands a stored value straight to `setColorScheme`, so
naming the third one `system` would buy a mapping layer and nothing else. The
**field** is `theme` rather than Mantine's `colorScheme` because the contract is
named for what it means, not for the library that renders it; the members stay
Mantine's precisely because those *are* handed over unmapped.

`users/` is also where **delivery** lives, and it is the one schema here split
into two shapes rather than one partialled into a patch. `UserPreferences` is
what a reader may set (`locale`, `theme`, `deliveryChannel`, `telegramChatId`)
**plus four fields only the server writes** — `email` and `emailVerified` come
from Auth0, `emailSuspendedAt` and `emailSuspendedReason` from an unsubscribe.
`UpdateUserPreferences` partials the writable half alone, so a `PATCH` cannot
advertise a field it may not set. `TelegramChatIdSchema` carries no
`.meta({ id })` for the same reason `CronExpressionSchema` does not: it is a
field validator, and an id would put a bare string in the document as a schema of
its own. **The one rule that cannot live here** is *telegram implies a chat id* —
a patch setting only the channel is valid against a row that already has one, so
`apps/server` checks the merged result and answers
`DELIVERY_TELEGRAM_CHAT_ID_REQUIRED`.

`health/` is `Health`, whose `db`
is a closed set rather than a probe message, because the route is public and a
driver error names the host, port, database and user.

`common/` is the error contract: `ErrorCode` (the machine-readable reason a
request failed), `ValidationIssue` (a Zod issue flattened to something
JSON-safe), and `ApiError` — the body `apps/server`'s exception filter returns
for **every** failure, and the shape `apps/client`'s fetcher parses.
