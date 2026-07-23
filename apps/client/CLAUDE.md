# `@personal-agent/client`

The React + Mantine admin portal. Vite, TanStack Query, Auth0 SPA. Reaches
`apps/server` over HTTP only — the workspace dependency on it is a devDependency,
for codegen input alone. `@personal-agent/schemas` is a real runtime dependency,
so the portal validates against the same Zod objects the API does. See the
[root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm dev` (root) | Vite on `:5173`. Needs `.env` and the API running. |
| `build` / `preview` | Production bundle, and serve it locally. |
| `generate` | orval → `src/api/generated/`. Runs as part of root `pnpm generate`. |

## The generated API client

The portal consumes the API **only** through orval-generated TanStack Query
hooks, so a breaking API change surfaces as a typecheck failure in the UI rather
than at runtime. `src/api/generated/` is regenerated output — never hand-edit it,
and never hand-write a fetch call alongside it. Hook names come from the API's
`operationId`s (`useListTopics`, `useCreateTopic`, `useDeleteTopic`, plus
`getListTopicsQueryKey` for invalidation).

Output is **split by OpenAPI tag** — `generated/topics/topics.ts`,
`generated/me/me.ts` — with every schema under `generated/model/`. An API
controller that gains a tag moves its hooks to a new folder.

The input is `../server/src/generated/openapi.yaml`, which is **gitignored and
rebuilt**, so a fresh clone must build `apps/server` before codegen can run; root
`pnpm generate` does both in order. If a hook is missing after an API change,
regenerate from the root rather than running `orval` here.

The mutator (`src/api/api-fetcher.ts`) must return orval's
**`{ data, status, headers }` envelope** — that is orval's contract for its fetch
client, not a choice, and the generated response types are written to match it.
It also prefixes the API origin, attaches the bearer token, tolerates a
204/empty body, and turns a non-OK response into an `ApiError` carrying the
status, `errorCode` and `params` it parses out of the API's `ApiError` body.

Because the API documents its error responses, a generated response type is a
**union discriminated by `status`** — `TopicsPage` narrows on `status === 200` to
reach the list. The other arm is unreachable in practice: the mutator throws
before a non-OK response ever becomes `data`.

## Auth

The access token reaches the mutator through a **module-level slot**
(`src/auth/token.ts`) set by `AuthTokenBridge`: the mutator is a plain function
and cannot call `useAuth0()`. The bridge renders its children only once the
getter is installed, so no request can leave without an `Authorization` header.

`main.tsx` wraps the app in `Auth0Provider` with the API audience in
`authorizationParams` — without that audience Auth0 issues an opaque token the
API cannot verify. Queries are configured `retry: false`, so an auth or
validation failure surfaces immediately instead of after backoff.

## Env

`vite.config.ts` sets `envDir: '../..'` to load the repo-root `.env`. Only
`VITE_`-prefixed keys are copied, and **Vite inlines them into the browser
bundle** — so nothing secret may carry that prefix. The Auth0 SPA client uses
PKCE and has no secret to leak; keep it that way.

`src/env.ts` validates the four `VITE_*` variables with Zod at module load and
throws one message listing every problem, so a misconfigured portal fails loudly
at startup rather than as a confusing redirect loop.

## Validation

Forms parse with the schema from `@personal-agent/schemas` that the API validates
the same request against — `TopicsPage` runs `CreateTopicSchema.safeParse` before
mutating, so a too-short subject never becomes a request. This is the only
runtime import that crosses a workspace boundary here; everything else about
`apps/server` is reached over HTTP.

## UI

Mantine with `defaultColorScheme="auto"`, `AppShell` for the frame, and
`@mantine/notifications` for mutation errors. Component styles come from Mantine
props and PostCSS (`postcss-preset-mantine`) — there is no CSS-in-JS layer and no
separate design system. `TopicsPage` is the one feature page; it invalidates the
list query key after each mutation rather than mutating the cache by hand.
