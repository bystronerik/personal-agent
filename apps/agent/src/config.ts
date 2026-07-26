import type { EmbeddingConfig } from '@personal-agent/embedding'
import {
  DATABASE_URL,
  loadEnv,
  OPENROUTER_API_KEY,
  OPENROUTER_EMBEDDING_DIMENSIONS,
  OPENROUTER_EMBEDDING_MODEL,
  OPENROUTER_MODEL,
} from '@personal-agent/env'

const AGENT_ENV = {
  apiKey: OPENROUTER_API_KEY,
  model: OPENROUTER_MODEL,
}

export const loadAgentConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(AGENT_ENV, { source, subject: 'The agent' })

export type AgentConfig = ReturnType<typeof loadAgentConfig>

const DATABASE_ENV = {
  databaseUrl: DATABASE_URL,
}

/**
 * Separate from `loadAgentConfig` so the layers that need no corpus — every
 * eval, every unit test, `pnpm agent` on a fixture — still run with no
 * `DATABASE_URL`. Only `sources/corpus.ts` and the worker read this, and both
 * read it lazily.
 */
export const loadDatabaseConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(DATABASE_ENV, { source, subject: 'The agent database' })

const EMBEDDING_ENV = {
  apiKey: OPENROUTER_API_KEY,
  model: OPENROUTER_EMBEDDING_MODEL,
  dimensions: OPENROUTER_EMBEDDING_DIMENSIONS,
}

/**
 * The same three variables `apps/ingest` selects, because a query has to land in
 * the vector space the documents were written into. They are declared once in
 * `packages/env`, which is what keeps the two apps agreeing.
 */
export const loadEmbeddingConfig = (
  source: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig =>
  loadEnv(EMBEDDING_ENV, { source, subject: 'The agent embedding client' })
