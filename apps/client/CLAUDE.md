# @personal-agent/client

The admin portal. Vite, React 19, Mantine, TanStack Query and TanStack Router, with
Auth0 for sign-in. Entry point: `src/main.tsx`, which mounts the providers.
`src/App.tsx` holds the sign-in gate and `src/router.tsx` holds the route tree.

## Scripts

| Script | Effect |
| --- | --- |
| `start:dev` | Vite dev server on port 3000. `prestart:dev` runs `generate:api` first |
| `build` | `tsc`, then `vite build`. `prebuild` runs `generate:api` first |
| `generate:api` | orval reads `../server/src/generated/openapi.yaml` and writes `src/generated/api` |
| `preview` | Serve the built bundle |

## Structure

- `src/generated/api/` — orval output: one folder for each `@ApiTags` group, plus
  `model/`. **Never edit these files.** Change the server contract, then regenerate.
- `src/lib/api-fetcher.ts` — the orval mutator. It adds the API origin and the bearer
  token, and it converts a failed response into `ApiError`.
- `src/auth/token.ts` — a module-level slot for the token getter. `AuthTokenBridge`
  fills it from inside the Auth0 provider, because the mutator cannot call a hook.
- `src/schedules/useSchedules.ts` and `src/preferences/usePreferences.ts` — the only
  places that read and write those two endpoints.
- `src/pages/` — one file for each route. `src/layout/` holds the shell.
- `src/i18n/locales/en.ts` — all user-visible text. The error map is typed against
  `ErrorCode`, so a new server error code breaks the build here until you translate it.

## Gotchas

- Run `pnpm generate:spec` in `apps/server` before `generate:api`, or orval reads a
  stale OpenAPI file. The root `pnpm build` chains both steps for you.
- `src/env.ts` reads `import.meta.env` with static keys only. Add a new `VITE_` variable
  to `packages/env/src/client-vars.ts` and to that source map together.
- `/unsubscribe` renders outside the router and without a session. Keep the check in
  `App.tsx`; the Auth0 redirect fires before `RouterProvider` mounts.
- `/` must stay a component route. Auth0 returns to the origin with `?code=&state=`, and
  an early redirect breaks the callback.
- The Docker image takes the `VITE_*` values as build arguments. A different Auth0 tenant
  needs a new image.
