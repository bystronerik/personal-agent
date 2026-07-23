# `@personal-agent/telegram`

A thin delivery layer over [grammY](https://grammy.dev) for sending the brief.
Standalone — no workspace dependencies and no dependents yet; wiring it to the
agent is future work. See the [root CLAUDE.md](../../CLAUDE.md) for the
workspace-wide picture.

grammY owns the transport, the response envelope, and error typing. What is left
here is what grammY has no opinion about: env validation, message splitting, and
CLI error formatting.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm telegram:send-test` | Send a test message to `TELEGRAM_CHAT_ID`. Needs `.env`. |
| `pnpm --filter @personal-agent/telegram telegram:send-test --long` | Same, but a message long enough to exercise the splitter. The root `pnpm telegram:send-test` runs through Turbo, which swallows the flag. |
| `pnpm telegram:chat-id` | List every chat the bot can currently see, to discover the chat id. |
| `pnpm test` | Vitest over `splitMessage`. Offline. |

Setup order: create a bot with @BotFather → put the token in `.env` → send the
bot a message → run `pnpm telegram:chat-id` → put the id in `.env` → `pnpm
telegram:send-test` to confirm. For a group, add the bot as a member first; for
a channel, make it an admin.

## Layout

```
src/client.ts   the Api factory + the two methods used
src/split.ts    splitMessage — the 4096-character cap
src/config.ts   env → validated config
src/scripts/    the CLIs above, plus runScript
```

## `Api`, not `Bot`

This package only sends, so `createApi` builds a bare `Api` — no middleware
stack, no update loop, no `init()` round-trip. `bot.api` *is* an `Api`, so
handling incoming messages later is additive rather than a rewrite.

`getUpdates` is called raw, without offset tracking, so repeated calls return the
same backlog. That is what chat-id discovery wants; the grammY-native
alternative (`bot.on('message')` + `bot.start()`) confirms updates and never
terminates on its own.

## Errors

grammY raises two kinds, and neither carries the bot token:
`ApiClientOptions.sensitiveLogs` defaults to `false`, so the token is redacted
from error messages by the library. There is no hand-rolled redaction here any
more — but keep the default in mind before ever setting `sensitiveLogs: true`,
since the token is a path segment of every request URL.

- **`GrammyError`** — Telegram answered `ok: false`. The message already names
  the method, code, and description.
- **`HttpError`** — the server was unreachable. Its message names only the
  method; the reason worth reading (ECONNREFUSED, ENOTFOUND, a timeout) is on
  `.error`, which is why `runScript` unwraps it.

This is coarser than what preceded it: a non-JSON body and a result that does not
match its schema are no longer distinct, hand-framed messages. Result validation
is gone entirely — the generated `grammy/types` are trusted instead.

## Retries

`autoRetry` is installed on every `Api`. It handles 429 `retry_after` and 5xx
backoff, which is what makes a multi-chunk send safe against the per-chat rate
limit. Two settings are deliberate:

- `rethrowHttpErrors: true` — the default retries transport failures too, which
  with `timeoutSeconds: 10` would make an unreachable host take three timeouts
  before a CLI said anything. Transport failures stay fail-fast.
- `maxDelaySeconds: 30` — the default caps 5xx backoff at *one hour*. A rate
  limit longer than 30s should fail loudly rather than park the CLI. Worth
  revisiting when delivery moves into a scheduled job, where waiting is free.

## Splitting

Telegram rejects a `text` longer than 4096 UTF-16 code units, and a brief will
exceed that. grammY has no plugin for this, so `splitMessage` is ours: it packs
greedily at paragraph boundaries, descends to line then word boundaries for a
part that will not fit, and hard-cuts only as a last resort. The hard cut
iterates code points, so a surrogate pair is never halved.

**It assumes plain text.** A chunk boundary inside an HTML or MarkdownV2 entity
leaves the tag unclosed and Telegram rejects that chunk with a 400. Adding
`parse_mode` to `sendMessage` means making the splitter format-aware first.

Chunks are sent sequentially and awaited individually — Telegram preserves order
per chat only for requests it receives in order.

## Config

`loadTelegramConfig()` validates the full config (token, chat id, optional API
root); `loadBotConnection()` validates only what a call needs, because chat-id
discovery runs *before* a chat id exists. Both share one `load()` that reports
every problem at once, keyed by the real environment variable name and pointing
at `.env.example`.

The field is `apiRoot`, matching grammY's vocabulary; the environment variable
remains `TELEGRAM_API_BASE`. The token and chat id are regex-checked
(`123456:ABC-…`; a numeric id, negative for groups and channels, or an
`@public_name`) so a paste error is caught locally rather than as a 401 from
Telegram. Blank values are treated as absent — see the root file's note on that
pattern.

The CLIs wrap their work in `runScript`, which prints one line and sets a
non-zero exit code: misconfiguration is the common failure here, and a stack
trace buries the line that says which variable is missing.
