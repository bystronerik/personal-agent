# `@personal-agent/email`

A thin delivery layer over [Resend](https://resend.com) for sending the brief by
email — the sibling of [`packages/telegram`](../telegram/CLAUDE.md), and the
second of the two channels a reader chooses between on the account page. Its only
workspace dependency is `@personal-agent/env`; its one consumer is `apps/agent`'s
worker, which imports it from `src/worker/delivery/deliver.ts` — the core never
touches it. See the [root CLAUDE.md](../../CLAUDE.md) for the workspace-wide
picture.

## Layout

```
src/index.ts     the public surface consumers import
src/client.ts    sendBriefEmail — the one call, plus the unsubscribe headers
src/config.ts    env → validated config (RESEND_API_KEY, EMAIL_FROM)
src/scripts/     email:send-test
```

## Commands

| Command | Effect |
| --- | --- |
| `pnpm --filter @personal-agent/email email:send-test --to you@example.com` | Send a test message. Needs `.env` and a verified domain. The root script goes through Turbo, which swallows the flag. |

**`EMAIL_FROM` must sit on a domain verified in Resend**, or every send is
rejected — that is the first thing to check when nothing arrives. There is no
sandbox equivalent of Telegram's "message the bot first".

## Plain text only

`sendBriefEmail` sets `text` and never `html`, because the brief a reader gets by
email is the *same string* `formatBrief` renders for Telegram. That is not a
shortcut to be undone later without thought: the format is what makes the two
channels one brief rather than two, and an HTML variant would be a second
rendering to keep in step with the first.

## One call, no splitting, no partial send

The Telegram path splits a brief across the 4096-character cap and can therefore
fail *partway*, which is what `PartialSendError` exists to describe. Email has no
such state: one API call either delivers the whole brief or delivers nothing, so
there is no analogue here and a failed send is safe for the worker's catch-up
pass to retry.

## The SDK reports failures in `error`, not by throwing

`resend.emails.send` resolves with `{ data, error }` and does **not** reject on a
rejected send. A caller that only awaits would record a delivery that never
happened, so `sendBriefEmail` checks both halves and throws. Nothing above this
file sees the SDK's envelope.

## Unsubscribe headers

Every send carries the RFC 8058 pair:

- `List-Unsubscribe: <url>` — the one-click endpoint
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

so Gmail and Outlook show their own Unsubscribe button. That URL is **the `POST`
route**, and the link in the body is a `GET` on the same token. The asymmetry is
load-bearing, not incidental: corporate link scanners prefetch URLs in a message
body, so a `GET` that suspended delivery immediately would unsubscribe readers who
never clicked. The `GET` only verifies and redirects to the portal, which asks;
`POST` is what commits, and a mail client sends it only on a real user action.

This package composes neither URL — `apps/agent` does, because it holds the
signing secret and the public API origin. What lives here is only the header
contract.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
