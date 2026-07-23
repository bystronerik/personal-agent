import { z } from 'zod'

const DEFAULT_API_ROOT = 'https://api.telegram.org'

/** `<bot_id>:<secret>`, as issued by BotFather. */
const BOT_TOKEN = /^\d+:[A-Za-z0-9_-]{30,}$/

/** A numeric id (negative for groups and channels) or an `@public_name`. */
const CHAT_ID = /^(-?\d+|@\w{5,})$/

/**
 * `.env` files routinely carry empty placeholders (`TELEGRAM_API_BASE=`), which
 * an optional field would otherwise accept as a valid empty string. Applied
 * outside the field schema so a blank reaches `.default()` as `undefined`.
 */
const blankAsAbsent = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** What every Bot API call needs. Chat id discovery has nothing else. */
export const BotConnectionSchema = z.object({
  botToken: z.preprocess(
    blankAsAbsent,
    z
      .string({ error: 'is required — talk to @BotFather to create a bot' })
      .regex(
        BOT_TOKEN,
        'does not look like a bot token (expected 123456:ABC-…)',
      ),
  ),
  apiRoot: z.preprocess(
    blankAsAbsent,
    z.url('must be a URL').default(DEFAULT_API_ROOT),
  ),
})

/** A connection plus the destination a brief is delivered to. */
export const TelegramConfigSchema = BotConnectionSchema.extend({
  chatId: z.preprocess(
    blankAsAbsent,
    z
      .string({ error: 'is required — run `pnpm telegram:chat-id` to find it' })
      .regex(CHAT_ID, 'expected a numeric chat id or an @public_name'),
  ),
})

export type BotConnection = z.infer<typeof BotConnectionSchema>
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>

const ENV_VAR: Record<keyof TelegramConfig, string> = {
  botToken: 'TELEGRAM_BOT_TOKEN',
  apiRoot: 'TELEGRAM_API_BASE',
  chatId: 'TELEGRAM_CHAT_ID',
}

function load<T>(schema: z.ZodType<T>, env: NodeJS.ProcessEnv): T {
  const parsed = schema.safeParse({
    botToken: env[ENV_VAR.botToken],
    apiRoot: env[ENV_VAR.apiRoot],
    chatId: env[ENV_VAR.chatId],
  })

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => {
        const field = issue.path[0] as keyof TelegramConfig | undefined
        return `  ${field ? ENV_VAR[field] : '(root)'} ${issue.message}`
      })
      .join('\n')
    throw new Error(
      `Telegram is not configured. Copy .env.example to .env and fix:\n${problems}`,
    )
  }

  return parsed.data
}

export const loadBotConnection = (
  env: NodeJS.ProcessEnv = process.env,
): BotConnection => load(BotConnectionSchema, env)

export const loadTelegramConfig = (
  env: NodeJS.ProcessEnv = process.env,
): TelegramConfig => load(TelegramConfigSchema, env)
