# `@personal-agent/server`

The NestJS admin API — auth, config, health, schedules, topics, user preferences
and delivery. Depends on
`@personal-agent/db` for all database access and on `@personal-agent/schemas` for
the contract it validates and publishes. Its `src/generated/openapi.yaml` is the
codegen input for `apps/client`. See the [root CLAUDE.md](../../CLAUDE.md) for the
workspace-wide picture.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm dev` (root) | `node --watch` on `src/main.ts` via swc-node, `:3000`; Swagger UI at `/docs`, document at `/openapi.json`. |
| `build` | `tsc --noEmit && rolldown` → `dist/main.js`. Runs as part of root `pnpm build`. **The `tsc` half is not decoration**: rolldown strips types with oxc and never checks them, so without it a type error bundles clean and fails at boot. |
| `start` | `node dist/main.js` — the built bundle, as the image runs it. |
| `openapi` | Rewrites `src/generated/openapi.yaml` (swc-node). Runs as part of root `pnpm generate`. |

## Two ways this code runs

**Development compiles just-in-time through `@swc-node/register`** — not `tsx`.
Nest's DI resolves constructor dependencies by reading their parameter **types**
at runtime (`emitDecoratorMetadata`), and esbuild — `tsx`'s compiler — cannot emit
that metadata at all; SWC can. The `openapi` script rides the same path.

**Deployment is a bundle**: `rolldown` inlines `packages/db|env|schemas` and
emits one `dist/main.js` that plain `node` runs, which is what lets the image
carry no source, no tsconfig and no compiler. Rolldown transforms through **oxc**,
which does emit decorator metadata — verified in the output, not assumed — so no
separate SWC pass is wired into the build. Three consequences worth knowing:

- **`nest build` is not an option here, despite this being a Nest app.** Its
  default builder is plain `tsc`, which does not bundle: the emitted `dist` would
  still `import '@personal-agent/db'` and resolve to raw TypeScript at runtime,
  and this package's own relative imports carry no extension (`moduleResolution:
  bundler`), so Node ESM could not resolve them either. Adopting it means giving
  the three workspace packages real `dist` builds and extensioned imports —
  reversing a repo-wide rule (see the [root CLAUDE.md](../../CLAUDE.md)), not
  changing a script.
- **The bundle's imports are the server's dependencies.** Inlining `packages/db`
  moves its `@prisma/adapter-pg` and `@prisma/client` imports into a file that
  resolves from `apps/server`, so both are declared here as well. Anything a
  bundled workspace package starts importing has to be added the same way.
- **Externalisation is by shape, not by list** (`rolldown.config.ts`): everything
  bare stays external except `@personal-agent/*` and the oxc decorator helpers.
  Nest lazily `require`s optional platform packages it may never load, and a
  bundler cannot follow those — a deny-list would have to grow every time Nest
  adds one. **The predicate has to test the absolute case too**: rolldown asks
  once with the written specifier and again with the resolved absolute path, so
  one that answers only the first marks every module external, exits 0, and emits
  an entry importing the source tree it was meant to inline. The size of
  `dist/main.js` (~39 kB) is the tell.

Both paths read the same tsconfig, so three compiler settings are load-bearing:

- `module: esnext` — overrides the base `preserve` so swc-node emits ESM (SWC has
  no `preserve` mode); paired with `moduleResolution: bundler`, imports stay
  extensionless. Top-level `await` in `main.ts` depends on the ESM output.
- `emitDecoratorMetadata` — Nest reads constructor parameter types at runtime, and
  both swc-node and the build's oxc pass honour this tsconfig flag; rolldown
  discovers the tsconfig itself, so the build config states no decorator options.
  **A DI failure that appears only in the container** is the signature of the
  built path losing it; `grep -c design:paramtypes dist/main.js` is the check —
  12 today, and zero is the failure.
- `useDefineForClassFields: false` — `define` semantics would overwrite injected
  properties with `undefined`.

## nestjs-zod

A request schema **is** a Zod schema, and the OpenAPI document is derived from it
— no class-validator DTOs duplicating types Zod already owns. The schemas live in
`@personal-agent/schemas`, so a `*.dto.ts` file here holds nothing but
`createZodDto` wrappers. `ZodValidationPipe`, `ZodSerializerInterceptor` and
`HttpExceptionFilter` are registered globally in `app.module.ts`.

Notes on the v5 API, since older material describes v4:

- **`cleanupOpenApiDoc`** replaces the older `patchNestJsSwagger()` monkey-patch,
  applied as a post-processing pass in `openapi.ts`.
- **`@ZodResponse`** is preferred over a bare `@ApiResponse`: it keeps runtime
  serialization, the OpenAPI schema, and the handler's return type in sync.
- DTO classes must be **value** imports in controllers. `emitDecoratorMetadata`
  records the class at runtime, and a type-only import erases it, leaving the
  validation pipe nothing to parse with. **The failure is silent** — the route
  simply stops validating.
- `@ApiOperation({ operationId })` and `@ApiTags` are set on every route and
  controller because orval derives its hook names and folder split from them (see
  the root file); an untagged route lands in a `default` folder.
- **`cleanupOpenApiDoc` stopped honouring `.meta({ id })` at zod 4.4.** Its
  rename keys off an `id` that zod 4.3 emitted at the root of its JSON Schema and
  4.4 no longer does, so a component would take its **DTO class name** instead —
  `ApiErrorDto`, and `ApiErrorDtoErrorCode` for a schema nested inside it.
  `openapi-postprocess.ts` puts the ids back; the naming in the document is ours,
  not nestjs-zod's. The one name it leaves alone is a `@ZodResponse` type, where
  nestjs-zod sets the id itself while generating — hence `Topic_Output`.

## Auth

`JwtAuthGuard` is registered as an `APP_GUARD`, so **a new route is protected
unless it carries `@Public()`**. Rows are scoped by the Auth0 `sub`, which
reaches handlers through the `@CurrentUser()` param decorator — single user or
not.

`JwtStrategy` verifies RS256 access tokens against the tenant's JWKS rather than
a configured key, because Auth0 rotates its key pair. Caching (10 min) and rate
limiting are on because this runs on every request. `AuthenticatedUser` carries
only `userId`; Auth0 sends many more claims and this API acts on none of them.
It is also the body of `GET /me`, so it lives in `@personal-agent/schemas/auth`
rather than in the strategy — which keeps only its internal `AccessTokenPayload`.

**The access token carries no email**, so `Auth0ProfileService` reads one from
the Management API — a client-credentials token against
`https://<domain>/oauth/token`, memoized until a minute before its `exp`, then
`GET /api/v2/users/{sub}`. That needs a **machine-to-machine Auth0 application**
(`AUTH0_MANAGEMENT_CLIENT_*`), authorised for the Management API with
`read:users`; it is not the SPA client, and it does have a secret. A failed read
returns `null` and logs rather than throwing: a profile that cannot be fetched
must not fail the request that happened to trigger the sync.

`UsersService` keeps **two** in-process sets for that, not one. `ensured` is the
row upsert; `syncAttempted` is recorded on failure *as well as* success, because
a subject Auth0 holds no address for would otherwise mean a Management API call
on every single request. Combined with syncing only when `email` is null, a
transient Auth0 outage is retried on the next process start — and a changed
address is never picked up, which is the accepted cost of "sync once after
registration".

`validate` also **ensures the caller's `users` row**, through `UsersService`,
before it returns. That happens in the auth path rather than in a handler because
the row is the foreign key every user-scoped table references: doing it here
guarantees it exists before any handler can write one, so there is no ordering to
get wrong. A `sub` seen once is remembered in-process, making this one `upsert`
per user per process rather than a query per request — a row deleted out of band
stays uncreated until restart, which is the trade accepted for it.

## Schedules

`schedules/` owns the rows the brief worker reads, so two of its rules exist for
things a type cannot catch:

- **croner has the last word on a pattern.** The request already passed
  `CronExpressionSchema`, which accepts a subset of croner's grammar and cannot
  import croner itself; `assertFirable` runs `new CronPattern()` before any write,
  so a pattern the worker cannot fire is unstorable no matter how the subset
  drifts. Note which layer rejects what: `0 0 L * *` is croner-legal and stopped by
  the pipe, `5/2 * * * *` is stopped by both.
- **`nextRunAt` is computed, never stored.** There is no such column — the worker
  keeps its jobs in croner, in memory — so the API answers "when is my next brief?"
  by building a `Cron` per row. Built with no handler it computes the occurrence and
  arms nothing.

`edition` reads back through `EditionSchema.catch('morning')` for the same reason
`locale` does: it is a plain column, and a row seeded by hand must not turn a list
request into a 500. **The cap (`MAX_SCHEDULES_PER_USER`) is counted inside the
create transaction and is a guardrail on cost, not a boundary** — two simultaneous
creates can still cross it under default isolation.

Ownership is the `where` clause, never a check after the read: `deleteMany`/
`findFirst` scoped by `userId`, and `update` through the `id_userId` compound
unique that `@@unique([id, userId])` provides. An id belonging to someone else
therefore reads as missing rather than forbidden, which is also what the topics
module does one level down.

## Unsubscribe

`unsubscribe/` is the only controller reachable **with no session at all**, and
the shape of it is the whole design:

- **`GET /unsubscribe?token=…` verifies and changes nothing**, then 302s to
  `${corsOrigin}/unsubscribe?token=…` (or `?error=invalid`). Corporate mail
  scanners prefetch the links in a message body, so a `GET` that suspended
  delivery would unsubscribe readers who never clicked. The portal it lands on is
  what asks.
- **`POST /unsubscribe?token=…` commits**, and serves both the RFC 8058
  one-click button — which a mail client sends only on a real user action — and
  the portal's confirmation. The token stays in the *query* because a one-click
  `POST` carries a fixed body of its own with no room for ours.
- The whole controller is **`@ApiExcludeController()`**, so orval generates no
  hooks for it. It must not: a generated hook attaches an access token that, on
  this route, by definition is not there. `apps/client` reaches the `POST` with a
  plain `fetch` — the one place it is allowed to.

The token itself is **not defined here** — it lives in
`@personal-agent/email/unsubscribe`, because `apps/agent` signs what this
verifies and one encoding in one file is what keeps two processes agreeing.
Suspension is `updateMany` scoped to `emailSuspendedAt: null`, so unsubscribing
twice does not move the recorded moment.

Undoing it is `POST /me/preferences/resume-email`, deliberately its own
authenticated route rather than a writable field on the patch: an unsubscribe is
the reader's decision, so no other control on the account page can reverse it as
a side effect.

## Config

`config/config.ts` holds the spec; `loadApiConfig(source = process.env)` parses
the environment through the shared loader, and `config.module.ts` provides the
result as `API_CONFIG`. Domain and audience are regex/shape-checked so the common
mistakes — pasting a URL as the domain, or the API URL as the audience — fail at
boot with an explanation rather than as 401s.

`env-file.ts` is a **different** thing despite the similar name, which is why the
spec is not called `env.ts`: it is a side-effect module imported **first** by
`main.ts`, loading the repo-root `.env` three levels up from this file, because
`dotenv/config` would only look in the working directory.

## Prisma

`PrismaService` **holds** a client rather than extending one, so construction
stays in `createPrismaClient` where the driver adapter is configured. Connecting
is left **lazy** — Prisma dials on first query, which is what keeps
`NestFactory.create()` usable with no database running. `emit-openapi.ts` depends
on exactly that.

## Errors

`HttpExceptionFilter` is an `APP_FILTER`, so **every** failure leaves as an
`ApiError` — `{ statusCode, message, timestamp, path }` plus an optional
`errorCode`, `params`, and `errors`. That shape is documented on the routes that
can produce it (`@ApiNotFoundResponse({ type: ApiErrorDto })` and friends), which
is what gives `apps/client` a typed error instead of `unknown` — and what widens
orval's response union, so the portal narrows on `status` to reach the success
case.

Two things the filter does deliberately:

- **A 5xx never echoes its reason.** An unexpected throw can carry a connection
  string or a failed query in its message, so anything ≥ 500 responds
  `Internal server error` and the real message and stack are logged instead.
- **Zod issues are flattened** to `ValidationIssue` — nestjs-zod reports raw
  issues whose `path` is a `(string | number | symbol)[]`, which neither survives
  JSON nor describes cleanly in OpenAPI.

A route signals *why* it failed by throwing a body rather than a string:
`throw new NotFoundException({ message, errorCode: ErrorCode.TOPIC_NOT_FOUND,
params })`. Anything not in `ErrorCode` is dropped by the filter's parse, so a new
reason is added to the schemas package first.

## The generated `openapi.yaml`

Regenerate with root `pnpm generate` after any change to a route, DTO, or
`operationId`.

`buildOpenApiDocument` is shared by the served `/docs` and by
`scripts/emit-openapi.ts`, so the generated document and the live one cannot
describe different APIs. The script builds a full application context without
listening or touching Postgres.

`openapi-postprocess.ts` runs **inside** `buildOpenApiDocument` for that reason,
rather than in the emit script. It reconciles what zod 4 emits with what an
OpenAPI 3.0 document may say and what orval accepts:

- strips the `id` that `.meta({ id })` leaves on a component;
- strips `propertyNames`, which `z.record()` emits and OpenAPI has no slot for;
- rewrites `additionalProperties: {}` to `true`;
- **renames components to the ids their schemas were tagged with**, since zod 4.4
  broke the rename nestjs-zod does (see above): `ApiErrorDto` → `ApiError`, and
  `ApiErrorDtoErrorCode` → `ErrorCode` for a nested one. A name whose id is
  already taken keeps the one it has, so a collision is visible rather than
  silently merged;
- **repairs dangling `$ref`s.** `cleanupOpenApiDoc` rewrites the reference a
  response holds directly but not one nested under `items`, so an array response
  is left pointing at the pre-rename name — `listTopics` referencing
  `TopicDto_Output` when the component is `Topic_Output`. Without this, orval
  refuses to generate at all.

A route excluded with `@ApiExcludeController()` is absent from the document
entirely, so it generates no client and appears in no diff — `unsubscribe/` is
the only one, and it is excluded on purpose (see above).

`scripts/openapi-env.ts` fills in **placeholder credentials** for anything absent,
because the document is derived from decorators alone and codegen must work on a
fresh clone — but `AppModule` still validates its configuration on construction.
Only absent values are filled; a configured `.env` still wins.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
