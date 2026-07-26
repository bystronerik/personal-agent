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
hooks. `src/api/generated/` is regenerated output — never hand-edit it, and never
hand-write a fetch call alongside it. Names come from the API (see the root
file): `useListTopics`, `useCreateTopic`, `useDeleteTopic`, plus
`getListTopicsQueryKey` for invalidation. Output is split by OpenAPI tag —
`generated/topics/topics.ts`, `generated/me/me.ts` — with every schema under
`generated/model/`.

The input is `../server/src/generated/openapi.yaml`. If a hook is missing after
an API change, regenerate from the root rather than running `orval` here.

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

`vite.config.ts` sets `envDir: '../..'` to load the repo-root `.env`; only
`VITE_`-prefixed keys are copied, and Vite inlines them into the bundle. The
Auth0 SPA client uses PKCE and has no secret to leak; keep it that way.

`src/env.ts` validates the four `VITE_*` variables at module load and throws one
message listing every problem, so a misconfigured portal fails loudly at startup
rather than as a confusing redirect loop.

## Validation

Forms parse with the schema from `@personal-agent/schemas` that the API validates
the same request against — `TopicsPage` runs `CreateTopicSchema.safeParse` before
mutating, so a too-short subject never becomes a request. This is the only
runtime import that crosses a workspace boundary here.

## Routing

`@tanstack/react-router` with a **code-defined** route tree (`src/router.tsx`) —
not file-based, so there is no Vite plugin and no generated route tree to sequence
into `pnpm generate`. The `declare module` block registering `typeof router` is
what makes `Link to=` a typed union: a path that is not a route fails
`pnpm typecheck` instead of 404ing at runtime. It has to stay an `interface`
(declaration merging), which is the one `biome-ignore` in the workspace.

**Topics is the index route (`/`), not `/topics`.** Auth0 returns to the origin
carrying `?code=&state=`, and a `/` → `/topics` redirect firing before the SDK
consumes those params would break the callback.

`App.tsx` keeps the auth gate and renders `RouterProvider` only once
authenticated, with `AuthTokenBridge` still **outside** the router — so the
no-request-without-a-token guarantee above is unchanged. The root route's
component is `layout/AppLayout`, so every page renders inside the shell.

## UI

Mantine with `defaultColorScheme="auto"`, `AppShell` for the frame, and
`@mantine/notifications` for mutation errors. Component styles come from Mantine
props and PostCSS (`postcss-preset-mantine`) — there is no CSS-in-JS layer and no
separate design system. Icons are `lucide-react`, imported per icon.

The frame is navbar-only: `layout/AppNavbar` fills it with three
`AppShell.Section`s — brand, the main `NavLink` list, and a footer pairing
`Account` with `Log out`. The signed-in email is deliberately **not** in the
navbar; it lives on `AccountPage`, one click away. `Log out` is a `NavLink`
(`component="button"`) rather than a `Button` so the two footer rows match.

**A header exists only below `sm`**, where a collapsed navbar would have nothing
to reopen it; `header={{ height: { base: 56, sm: 0 } }}` plus `hiddenFrom="sm"`
leaves desktop with no header at all.

`NavLink`s are wired with **`renderRoot`, not `component={Link}`** — the
polymorphic `component` prop erases the router's typed `to`, which is the whole
point of the typed tree. Active state compares `useLocation().pathname` exactly,
so a future nested route would need a prefix match instead.

Feature pages live in `src/pages` (`TopicsPage`, and a read-only `AccountPage`
pairing `useGetMe` with the Auth0 profile). A page invalidates the query key it
affects after each mutation rather than mutating the cache by hand, and both
render a failed request through the shared `describe` (`src/lib/errors.ts`).

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
