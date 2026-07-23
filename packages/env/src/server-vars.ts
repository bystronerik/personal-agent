import { z } from 'zod'

import { envVar } from './load'

// Node-side variables, read from `process.env`. Reached through the package root
// (`@personal-agent/env`) — never through `./client`, so none of this reaches a
// browser bundle.

// --- Database (packages/db, apps/server) ---

export const DATABASE_URL = envVar(
  'DATABASE_URL',
  z
    .string({ error: 'is required — see .env.example' })
    .startsWith('postgresql://', 'must be a postgresql:// connection string'),
)

// --- Auth0, server side (apps/server) ---

export const AUTH0_DOMAIN = envVar(
  'AUTH0_DOMAIN',
  z
    .string({ error: 'is required — the Auth0 tenant domain, no scheme' })
    .regex(
      /^[a-z0-9-]+(\.[a-z0-9-]+)+$/,
      'expected a bare hostname such as your-tenant.eu.auth0.com',
    ),
)

export const AUTH0_AUDIENCE = envVar(
  'AUTH0_AUDIENCE',
  z.string({
    error: 'is required — the identifier of your Auth0 API, not a URL to call',
  }),
)

// --- API server (apps/server) ---

const DEFAULT_API_PORT = 3000
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173'

export const API_PORT = envVar(
  'API_PORT',
  z.coerce.number().int().positive().default(DEFAULT_API_PORT),
)

export const CORS_ORIGIN = envVar(
  'CORS_ORIGIN',
  z.url('must be a URL').default(DEFAULT_CORS_ORIGIN),
)

// --- Telegram (packages/telegram) ---

/** `<bot_id>:<secret>`, as issued by BotFather. */
const BOT_TOKEN = /^\d+:[A-Za-z0-9_-]{30,}$/
/** A numeric id (negative for groups and channels) or an `@public_name`. */
const CHAT_ID = /^(-?\d+|@\w{5,})$/
const DEFAULT_TELEGRAM_API_BASE = 'https://api.telegram.org'

export const TELEGRAM_BOT_TOKEN = envVar(
  'TELEGRAM_BOT_TOKEN',
  z
    .string({ error: 'is required — talk to @BotFather to create a bot' })
    .regex(BOT_TOKEN, 'does not look like a bot token (expected 123456:ABC-…)'),
)

export const TELEGRAM_API_BASE = envVar(
  'TELEGRAM_API_BASE',
  z.url('must be a URL').default(DEFAULT_TELEGRAM_API_BASE),
)

export const TELEGRAM_CHAT_ID = envVar(
  'TELEGRAM_CHAT_ID',
  z
    .string({ error: 'is required — run `pnpm telegram:chat-id` to find it' })
    .regex(CHAT_ID, 'expected a numeric chat id or an @public_name'),
)
