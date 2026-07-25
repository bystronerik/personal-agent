import { autoRetry } from '@grammyjs/auto-retry'
import { Api } from 'grammy'
import type { Message, Update } from 'grammy/types'

import type { BotConnection, TelegramConfig } from './config'
import { splitMessage } from './split'

const REQUEST_TIMEOUT_SECONDS = 10

/** A rate limit longer than this fails loudly rather than parking the CLI. */
const MAX_RETRY_DELAY_SECONDS = 30

/**
 * Send-only, so `Api` rather than `Bot` — no middleware stack and no update
 * loop. `bot.api` is an `Api`, so handling incoming messages later is additive.
 */
function createApi(config: BotConnection): Api {
  const api = new Api(config.botToken, {
    apiRoot: config.apiRoot,
    timeoutSeconds: REQUEST_TIMEOUT_SECONDS,
  })

  api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: MAX_RETRY_DELAY_SECONDS,
      rethrowHttpErrors: true,
    }),
  )

  return api
}

/**
 * Sends sequentially: Telegram preserves order per chat only for requests it
 * receives in order, and a burst can trip the per-chat rate limit, which
 * autoRetry absorbs.
 */
export async function sendMessage(
  config: TelegramConfig,
  text: string,
): Promise<Message.TextMessage[]> {
  const api = createApi(config)

  const sent: Message.TextMessage[] = []
  for (const chunk of splitMessage(text)) {
    sent.push(await api.sendMessage(config.chatId, chunk))
  }
  return sent
}

/**
 * Unacknowledged updates, used only to discover a chat id. Offsets are not
 * tracked, so repeated calls return the same backlog.
 */
export function getUpdates(config: BotConnection): Promise<Update[]> {
  return createApi(config).getUpdates()
}
