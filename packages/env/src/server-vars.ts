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

/**
 * A machine-to-machine application authorised for the Auth0 Management API with
 * the `read:users` scope — a different application from the SPA the portal signs
 * in with, and the only way to read a subject's email address.
 */
export const AUTH0_MANAGEMENT_CLIENT_ID = envVar(
  'AUTH0_MANAGEMENT_CLIENT_ID',
  z
    .string({
      error: 'is required — the client id of your Auth0 machine-to-machine app',
    })
    .min(1),
)

export const AUTH0_MANAGEMENT_CLIENT_SECRET = envVar(
  'AUTH0_MANAGEMENT_CLIENT_SECRET',
  z
    .string({
      error:
        'is required — the client secret of your Auth0 machine-to-machine app',
    })
    .min(1),
)

// --- API server (apps/server) ---

const DEFAULT_API_PORT = 3001
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000'

export const API_PORT = envVar(
  'API_PORT',
  z.coerce.number().int().positive().default(DEFAULT_API_PORT),
)

export const CORS_ORIGIN = envVar(
  'CORS_ORIGIN',
  z.url('must be a URL').default(DEFAULT_CORS_ORIGIN),
)

/**
 * Where the API answers from the public internet — not `CORS_ORIGIN`, which is
 * the portal. `apps/agent` builds unsubscribe links against this, and it is the
 * one host a mail client reaches without a session.
 */
export const PUBLIC_API_URL = envVar(
  'PUBLIC_API_URL',
  z.url('must be a URL').default(`http://localhost:${DEFAULT_API_PORT}`),
)

/**
 * Signs the unsubscribe token. `apps/server` verifies what `apps/agent` signed,
 * so the two processes must be given the same value; rotating it invalidates the
 * link in every brief already delivered.
 */
export const UNSUBSCRIBE_SECRET = envVar(
  'UNSUBSCRIBE_SECRET',
  z
    .string({ error: 'is required — generate one with `openssl rand -hex 32`' })
    .min(32, 'must be at least 32 characters'),
)

// --- OpenRouter (apps/agent) ---

/** The first entry of `COMPARED_MODELS`, and what a run uses unless overridden. */
export const DEFAULT_OPENROUTER_MODEL = 'x-ai/grok-4.5'

export const OPENROUTER_API_KEY = envVar(
  'OPENROUTER_API_KEY',
  z
    .string({
      error: 'is required — create a key at https://openrouter.ai/keys',
    })
    .min(1),
)

export const OPENROUTER_MODEL = envVar(
  'OPENROUTER_MODEL',
  z.string().default(DEFAULT_OPENROUTER_MODEL),
)

// --- Corpus ingest (apps/ingest) ---

const DEFAULT_EMBEDDING_MODEL = 'qwen/qwen3-embedding-8b'
/**
 * Must equal the width of `articles.embedding`. pgvector rejects a mismatched
 * vector at insert time, and nothing checks the two agree before then.
 */
const DEFAULT_EMBEDDING_DIMENSIONS = 4000
const DEFAULT_RETENTION_DAYS = 30

export const OPENROUTER_EMBEDDING_MODEL = envVar(
  'OPENROUTER_EMBEDDING_MODEL',
  z.string().default(DEFAULT_EMBEDDING_MODEL),
)

export const OPENROUTER_EMBEDDING_DIMENSIONS = envVar(
  'OPENROUTER_EMBEDDING_DIMENSIONS',
  z.coerce.number().int().positive().default(DEFAULT_EMBEDDING_DIMENSIONS),
)

export const INGEST_RETENTION_DAYS = envVar(
  'INGEST_RETENTION_DAYS',
  z.coerce.number().int().positive().default(DEFAULT_RETENTION_DAYS),
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

/**
 * The `telegram:*` dev scripts only. Delivery reads `users.telegram_chat_id`,
 * so this is no longer where a brief is addressed and there is no fallback to it.
 */
export const TELEGRAM_CHAT_ID = envVar(
  'TELEGRAM_CHAT_ID',
  z
    .string({ error: 'is required — run `pnpm telegram:chat-id` to find it' })
    .regex(CHAT_ID, 'expected a numeric chat id or an @public_name'),
)

// --- Email (packages/email) ---

/** `Name <local@domain>` or a bare address. */
const FROM_ADDRESS = /^(.+\s)?<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/

export const RESEND_API_KEY = envVar(
  'RESEND_API_KEY',
  z
    .string({
      error: 'is required — create a key at https://resend.com/api-keys',
    })
    .startsWith('re_', 'does not look like a Resend key (expected re_…)'),
)

/** Must sit on a domain verified in Resend, or every send is rejected. */
export const EMAIL_FROM = envVar(
  'EMAIL_FROM',
  z
    .string({
      error: 'is required — a sender on a domain you have verified in Resend',
    })
    .regex(FROM_ADDRESS, 'expected an address or "Name <address>"'),
)
