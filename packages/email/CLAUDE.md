# @personal-agent/email

Two things that are exported through two different subpaths.

- `.` → `src/index.ts`: `sendBriefEmail()` and `loadEmailConfig()`. It uses Resend.
- `./unsubscribe` → `src/unsubscribe.ts`: `signUnsubscribeToken()` and
  `verifyUnsubscribeToken()`. It uses `node:crypto` only.

`apps/agent` imports both. `apps/server` imports `./unsubscribe` only, because it
verifies tokens but sends no mail. The package imports `packages/env`.

## Scripts

| Script | Effect |
| --- | --- |
| `email:send-test` | Send one test message with the configured key and sender |
| `test` | Vitest. `src/unsubscribe.test.ts` covers the token |
| `build` | `tsc` only |

## Gotchas

- Keep the subpath split. If `apps/server` imports the root barrel, the Resend SDK enters
  its bundle.
- `sendBriefEmail` throws on a rejected send. The Resend SDK reports the failure in
  `error` and does not throw, thus a plain `await` would record a delivery that never
  happened.
- The token is stateless and has no expiry, because a link in an old brief must still
  work. Rotation of `UNSUBSCRIBE_SECRET` is the only revocation, and it invalidates every
  delivered link at the same time.
- `apps/agent` signs and `apps/server` verifies. Give the same secret to both processes.
- `oneClickUnsubscribeUrl` becomes the `List-Unsubscribe` header (RFC 8058). The caller
  composes the visible link in the body text. Only the `POST` may change state.
- `EMAIL_FROM` must be on a domain that is verified in Resend, or each send fails.
