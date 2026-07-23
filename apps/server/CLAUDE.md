# `@personal-agent/server`

The NestJS admin API — auth, config, health, topics. Depends on
`@personal-agent/db` for all database access and on `@personal-agent/schemas` for
the contract it validates and publishes. Its `src/generated/openapi.yaml` is the
codegen input for `apps/client`. See the [root CLAUDE.md](../../CLAUDE.md) for the
workspace-wide picture.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm dev` (root) | `node --watch` on `src/main.ts` via swc-node, `:3000`; Swagger UI at `/docs`, document at `/openapi.json`. |
| `start` | `node --import @swc-node/register/esm-register src/main.ts`. No build — the server runs its TypeScript directly. |
| `openapi` | Rewrites `src/generated/openapi.yaml` (swc-node). Runs as part of root `pnpm generate`. |

## Runtime and decorators

The server runs its TypeScript **unbuilt**, through **`@swc-node/register`** — not
`tsc`+`node dist`, and not `tsx`. Nest's DI resolves constructor dependencies by
reading their parameter **types** at runtime (`emitDecoratorMetadata`), and
`tsx`/esbuild don't emit that metadata; SWC does. There is no `dist/` and no build
step.

Because of that runtime choice, three compiler settings are load-bearing:

- `module: esnext` — overrides the base `preserve` so swc-node emits ESM (SWC has no
  `preserve` mode); paired with `moduleResolution: bundler`, imports stay
  extensionless. Top-level `await` in `main.ts` depends on the ESM output.
- `emitDecoratorMetadata` — Nest reads constructor parameter types at runtime; swc-node
  honours this tsconfig flag.
- `useDefineForClassFields: false` — `define` semantics would overwrite injected
  properties with `undefined`.

## nestjs-zod

A request schema **is** a Zod schema, and the OpenAPI document is derived from it
— no class-validator DTOs duplicating types Zod already owns. The schemas
themselves live in `@personal-agent/schemas`, so `apps/client` validates against
the same objects; a `*.dto.ts` file here holds nothing but `createZodDto`
wrappers. `ZodValidationPipe`, `ZodSerializerInterceptor` and
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
- `@ApiOperation({ operationId })` is set on every route because orval derives
  the generated hook names from it; changing one renames a hook in `apps/client`.
  `@ApiTags` is set on every controller because orval splits the generated
  client by tag — an untagged route lands in a `default` folder.
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
rather than in the strategy — the strategy keeps only its internal
`AccessTokenPayload`.

## Config

`loadApiConfig()` parses the environment through a Zod schema and reports every
problem at once, keyed by the real variable name. Domain and audience are
regex/shape-checked so the common mistakes — pasting a URL as the domain, or the
API URL as the audience — fail at boot with an explanation rather than as 401s.

`env-file.ts` is a side-effect module imported **first** by `main.ts`: it loads
the repo-root `.env`, three levels up from this file either compiled or as
source, because `dotenv/config` would only look in the working directory.

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
is what gives `apps/client` a typed error instead of `unknown`.

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

Documenting an error response widens orval's generated response union, so
`apps/client` narrows on `status` to reach the success case.

## The generated `openapi.yaml`

`src/generated/openapi.yaml` is the codegen input for `apps/client`. It is
**gitignored and regenerated**, so nothing consumes it before the `openapi` emit
has run here — the Turbo graph (`^generate` → `openapi` → `generate`, i.e. Prisma
generate → this emit → orval) is what enforces that on a fresh clone. Regenerate
with root `pnpm generate` after any change to a route, DTO, or `operationId`.

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

The generated model names in `apps/client` come straight from these components, so
renaming a schema's `.meta({ id })` renames a file there.

`scripts/openapi-env.ts` fills in **placeholder credentials** for anything absent,
because the document is derived from decorators alone and codegen must work on a
fresh clone — but `AppModule` still validates its configuration on construction.
Only absent values are filled; a configured `.env` still wins.
