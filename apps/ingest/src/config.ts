import type { EmbeddingConfig } from '@personal-agent/embedding'
import {
  DATABASE_URL,
  INGEST_RETENTION_DAYS,
  loadEnv,
  OPENROUTER_API_KEY,
  OPENROUTER_EMBEDDING_DIMENSIONS,
  OPENROUTER_EMBEDDING_MODEL,
} from '@personal-agent/env'

const INGEST_ENV = {
  databaseUrl: DATABASE_URL,
  apiKey: OPENROUTER_API_KEY,
  embeddingModel: OPENROUTER_EMBEDDING_MODEL,
  embeddingDimensions: OPENROUTER_EMBEDDING_DIMENSIONS,
  retentionDays: INGEST_RETENTION_DAYS,
}

export const loadIngestConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(INGEST_ENV, { source, subject: 'The ingest worker' })

export type IngestConfig = ReturnType<typeof loadIngestConfig>

export const embeddingConfig = (config: IngestConfig): EmbeddingConfig => ({
  apiKey: config.apiKey,
  model: config.embeddingModel,
  dimensions: config.embeddingDimensions,
})
