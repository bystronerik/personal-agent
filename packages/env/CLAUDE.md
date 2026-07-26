# `@personal-agent/env`

The single home for environment loading: the `blankAsAbsent` rule, the `loadEnv`
validator, and every variable's name, schema, and default — knowledge that was
hand-rolled in four packages before this existed. A leaf: it depends on nothing
but `zod`, and every other workspace depends on it. See the
[root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Layout

```
src/blank.ts         blankAsAbsent — the one copy of "a blank env var is absent"
src/load.ts          envVar() + loadEnv() — the validator/formatter/throw
src/server-vars.ts   Node-side variables (DATABASE_URL, AUTH0_*, API_*,
                     OPENROUTER_*, TELEGRAM_*)
src/client-vars.ts   browser variables (VITE_*)
src/index.ts         package root `.`      — loader + server vars
src/client.ts        subpath `./client`    — loader + client vars only
```

## The mechanism

`envVar(name, schema)` declares a variable once: its real environment name bound
to the Zod schema that validates it, with the default living on the schema
(`.default(3000)`). A consumer assembles a **spec** — an object mapping its own
field names to those declarations — and hands it to `loadEnv`:

```ts
loadEnv({ port: API_PORT, databaseUrl: DATABASE_URL }, { source: process.env, subject: 'The API' })
```

`loadEnv` reads each variable from `source`, runs every value through
`blankAsAbsent`, validates the lot in one `z.object`, and on failure throws a
single message listing every problem keyed by the **real variable name** — not the
consumer's field name.

A consumer that needs a default the others must not get re-wraps the declaration
rather than reaching into `process.env`:
`envVar(DATABASE_URL.name, DATABASE_URL.schema.default(…))` in
`packages/db/prisma.config.ts`. The name and the validation stay shared; only the
default is local.

## Two entry points, and why the split is load-bearing

The browser bundle must not carry server-side config. `apps/client` reads
`import.meta.env`, and Vite only inlines `VITE_`-prefixed keys — but that alone
would still bundle the *definitions* (regexes, defaults, messages) of every server
variable if the client imported the package root, because a single re-export
barrel is not reliably tree-shaken. So the boundary is **structural, not
tree-shaking-dependent**:

- **`.`** (`index.ts`) re-exports the loader + `server-vars`. Node consumers use this.
- **`./client`** (`client.ts`) re-exports the loader + `client-vars` and **never
  imports `server-vars`**. `apps/client` imports only from here, so a server
  variable's definition cannot reach the browser bundle even by mistake.

`apps/client/src/env.ts` reads each value with an explicit static
`import.meta.env.VITE_*` access and passes them as the `source` — no bare
`import.meta.env`, no dynamic index — so only `VITE_` names ever appear in browser
code, and the values survive a production build.

## Runtime-agnostic by construction

`loadEnv` takes `source` as an argument and the package references `process`
nowhere. Node callers pass `process.env`; the browser passes statically-read
`import.meta.env` values. That is what lets one package serve both.

## The shape every consumer has

A Node consumer declares its spec in `<workspace>/src/config.ts` and exports
`load<Subject>Config(source: NodeJS.ProcessEnv = process.env)` —
`loadApiConfig`, `loadTelegramConfig`, `loadAgentConfig`. Taking `source` as a
defaulted parameter rather than reaching for `process.env` inside is what keeps
each loader testable; `config.ts` is the name because `env.ts` collides with the
*other* thing a workspace calls env (`apps/server/src/env-file.ts`, a dotenv
side-effect). `apps/server`'s lives at `src/config/config.ts`, next to the Nest
module that provides it.

`apps/client` is the one exception, and a justified one: a browser module has no
`process.env` to inject and must fail at import, so `src/env.ts` is an eager
module-level `export const env = loadEnv(…)`.

## Adding or changing a variable

Declare it once in `server-vars.ts` or `client-vars.ts` (its name, schema, and any
default), select it into the relevant consumer's spec, and — per the root file —
declare it in `turbo.json` for any task that reads it.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
