# @personal-agent/telegram

The Telegram Bot API client. `src/index.ts` exports `sendMessage()`, `getUpdates()`,
`splitMessage()`, `PartialSendError` and the two config loaders. Only `apps/agent`
imports it. It imports `packages/env`.

## Scripts

| Script | Effect |
| --- | --- |
| `telegram:chat-id` | Print the chat id of each chat that messaged your bot. Message the bot first |
| `telegram:send-test` | Send a test message. Add `--long` to exercise the splitter |
| `test` | Vitest. `src/split.test.ts` covers the splitter |
| `build` | `tsc` only |

## Structure

- `src/client.ts` — uses grammY's `Api`, not `Bot`. The client sends only; it runs no
  update loop and no middleware. `@grammyjs/auto-retry` absorbs a rate limit.
- `src/split.ts` — packs the text into 4096-character chunks. It prefers a paragraph
  break, then a line break, then a word break, then a hard cut.
- `src/config.ts` — `loadBotConnection()` needs the token and the API base.
  `loadTelegramConfig()` adds `TELEGRAM_CHAT_ID`.

## Gotchas

- The chat id is an argument to `sendMessage`, not part of the connection. A delivered
  brief goes to `users.telegram_chat_id`. `TELEGRAM_CHAT_ID` serves the two dev scripts
  above and nothing else, and there is no fallback to it.
- `sendMessage` sends the chunks in sequence. If a later chunk fails, it throws
  `PartialSendError` with the count already sent. The caller must not retry the whole
  text, because the reader has the first chunks.
- The client sets no `parse_mode`. Send plain text. A chunk boundary inside an HTML or
  MarkdownV2 entity leaves a tag unclosed and Telegram rejects the chunk.
- `getUpdates` does not track an offset, so repeated calls return the same backlog.
