# @personal-agent/env

Each environment variable is declared here one time, with its real name and its Zod
schema. Every other workspace reads its config through this package. It imports only
`zod`, and it has no runtime side effects.

## Exports

- `.` → `src/index.ts`: the loader and all Node-side variables from `server-vars.ts`.
- `./client` → `src/client.ts`: the loader and the `VITE_*` variables only, from
  `client-vars.ts`. `apps/client` uses this subpath.

The two files are separate so that no server secret can enter the browser bundle. Never
let `client.ts` import `server-vars.ts`.

## Scripts

`build` runs `tsc` only. There are no tests in this package.

## How to add a variable

1. Add an `envVar('NAME', schema)` export to `server-vars.ts` or to `client-vars.ts`.
   Put the default in the schema with `.default()`.
2. Add the field to the config object of each app that needs it, for example
   `apps/server/src/config/config.ts`.
3. Document the name and its purpose in `.env.example`. Do not write a real value there.
4. Add the name to the related task `env` list in `turbo.json`.
5. For a `VITE_` variable, also add a static `import.meta.env` read in `apps/client/src/env.ts`.

## Gotchas

- `blankAsAbsent` treats `NAME=` in `.env` as absent, so the value falls through to the
  schema default. Route every read through the loader, and this rule stays in one place.
- `loadEnv` collects all problems into one message that is keyed by the real variable
  name. Do not replace it with a per-variable read.
- A default belongs on the shared declaration only when it is correct everywhere.
  `packages/db/prisma.config.ts` adds its own default for `DATABASE_URL` on purpose, so
  that `apps/server` still fails at boot when the variable is missing.
- This package does not read a `.env` file. Each process does that itself: `apps/server`
  through `src/env-file.ts`, the CLI scripts through `--env-file-if-exists`, and the
  Vite apps through `envDir`.
