# @personal-agent/server

The admin API. NestJS 11 with `nestjs-zod`. Entry point: `src/main.ts`, which enables
CORS, mounts Swagger UI at `/docs` and listens on `API_PORT` (default 3001).
`src/app.module.ts` registers the modules and the global pipe, interceptor and filter.

## Scripts

| Script | Effect |
| --- | --- |
| `start:dev` | Run the API with `node --watch` and `@swc-node/register` |
| `generate:spec` | Write `src/generated/openapi.yaml`. Run it after any contract change |
| `build` | `tsc`, then rolldown to `dist/main.js` |
| `start:prod` | Run the built `dist/main.js` |

## Structure

- One folder for each feature: `auth/`, `health/`, `schedules/`, `topics/`, `users/`,
  `unsubscribe/`. Each holds a controller, a service, a module and a `*.dto.ts`.
- A `*.dto.ts` file only wraps a Zod schema from `packages/schemas` with
  `createZodDto`. Put the shape in `packages/schemas`, not here.
- `src/openapi.ts` builds the document for `/docs` and for the emitted file, thus the
  two cannot disagree. `src/openapi-postprocess.ts` restores the `.meta({ id })` names
  and repairs the nested `$ref`s that orval needs.
- `src/auth/jwt.strategy.ts` validates the access token against the tenant JWKS and
  upserts the `users` row. `src/users/auth0-profile.service.ts` reads the email address
  from the Auth0 Management API, which needs the machine-to-machine application.

## Gotchas

- Names in the OpenAPI document are load-bearing for the portal. `.meta({ id })` names
  the generated model file, `operationId` names the generated hook, and `@ApiTags` names
  the folder. Change one and the portal imports change.
- Import a DTO class as a value, not as a type. `emitDecoratorMetadata` records the class
  at runtime, and a type-only import leaves the pipe with nothing to parse with.
- `src/generated/` is generated. Never edit it, and do not commit it.
- The unsubscribe controller is excluded from the document on purpose. `GET` only
  verifies and redirects; only `POST` suspends delivery. Keep that split, because mail
  scanners prefetch links.
- `UNSUBSCRIBE_SECRET` must be the same value here and in `apps/agent`. Prisma connects
  lazily, so `generate:spec` runs with no database.
- A column that holds an enum is a plain string. A service reads it back with
  `.catch(DEFAULT)`, so an unknown value degrades instead of failing the request.
