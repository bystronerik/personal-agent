# @personal-agent/schemas

The Zod schemas that make the API contract. `apps/server` wraps them with `createZodDto`,
`apps/client` imports the inferred types, and `apps/agent` imports the shared enums. The
package imports only `zod`.

## Exports

The root `.` re-exports everything. There is also one subpath for each folder:
`./auth`, `./common`, `./health`, `./schedules`, `./topics`, `./users`. Import the
subpath. Add a new folder to the `exports` map in `package.json` and to `src/index.ts`.

## Scripts

`build` runs `tsc` only. There are no tests in this package.

## Structure

- `common/` — `ApiError` and the `ErrorCode` enum. The portal translates each code in
  `apps/client/src/i18n/locales/en.ts`, and that map is typed against this enum.
- `schedules/` — `cron.ts` holds a hand-written grammar that is narrower than croner's.
  `limits.ts` holds the per-user caps. `timezone.ts` validates the IANA zone.
- `users/preferences.ts` — locale, theme, delivery channel, and the split between the
  fields a reader may patch and the fields that only the server writes.
- `topics/` — the topic shape and the subject validator.

## Gotchas

- `.meta({ id })` names the OpenAPI component and therefore the generated model file in
  the portal. Do not rename an id without a regeneration of the portal client.
- Do not add `.meta({ id })` to a plain field validator. An id makes it a component of
  its own in the document. `EditionSchema` has no id for a different reason: `apps/agent`
  feeds it to structured outputs, which need the enum inline.
- The cron grammar is one-directional: everything that it accepts, croner must parse.
  `apps/server` re-checks a pattern with croner before it writes the row.
- A read schema keeps `cron` and `timezone` as plain strings, so that an older row still
  serializes instead of causing a 500.
- A rule that needs the merged state, for example "Telegram delivery needs a chat id",
  cannot live in a patch schema. `apps/server` enforces those rules.
- A `DEFAULT_*` constant here mirrors a column default in `packages/db`. Change both.
