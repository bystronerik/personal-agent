import {
  loadEnv,
  TELEGRAM_API_BASE,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from '@personal-agent/env'

/** What every Bot API call needs. Chat id discovery has nothing else. */
const CONNECTION_ENV = {
  botToken: TELEGRAM_BOT_TOKEN,
  apiRoot: TELEGRAM_API_BASE,
}

/** A connection plus the destination a brief is delivered to. */
const CONFIG_ENV = {
  ...CONNECTION_ENV,
  chatId: TELEGRAM_CHAT_ID,
}

export const loadBotConnection = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(CONNECTION_ENV, { source, subject: 'Telegram' })

export const loadTelegramConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(CONFIG_ENV, { source, subject: 'Telegram' })

export type BotConnection = ReturnType<typeof loadBotConnection>
export type TelegramConfig = ReturnType<typeof loadTelegramConfig>
