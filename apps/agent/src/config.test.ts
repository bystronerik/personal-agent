import { describe, expect, it } from 'vitest'

import {
  loadAgentConfig,
  loadDatabaseConfig,
  loadEmbeddingConfig,
} from './config'

const KEY = 'sk-or-test'

/**
 * The core can now import `packages/db`, so "an eval needs no database" stopped
 * being structural and became a matter of which config a layer reads. These
 * assertions are what keeps `pnpm eval`, `pnpm test` and `pnpm agent` runnable
 * on a machine with no Postgres.
 */
describe('the offline split', () => {
  it('loads the agent config with no DATABASE_URL in the environment', () => {
    expect(loadAgentConfig({ OPENROUTER_API_KEY: KEY })).toMatchObject({
      apiKey: KEY,
    })
  })

  it('loads the embedding config with no DATABASE_URL either', () => {
    expect(loadEmbeddingConfig({ OPENROUTER_API_KEY: KEY })).toMatchObject({
      model: 'qwen/qwen3-embedding-8b',
      dimensions: 4000,
    })
  })

  it('demands DATABASE_URL only from the loader the corpus uses', () => {
    expect(() => loadDatabaseConfig({})).toThrow(/DATABASE_URL/)
  })

  /** A blank reaches `.default()` as absent — see packages/env. */
  it('treats a blank embedding model as absent rather than as an empty id', () => {
    expect(
      loadEmbeddingConfig({
        OPENROUTER_API_KEY: KEY,
        OPENROUTER_EMBEDDING_MODEL: '',
      }).model,
    ).toBe('qwen/qwen3-embedding-8b')
  })

  /**
   * The width the ingest app writes and the width a query is embedded at have
   * to be one number, so it comes from one declaration in `packages/env`.
   */
  it('coerces the embedding width from the string an env var always is', () => {
    expect(
      loadEmbeddingConfig({
        OPENROUTER_API_KEY: KEY,
        OPENROUTER_EMBEDDING_DIMENSIONS: '2000',
      }).dimensions,
    ).toBe(2000)
  })
})
