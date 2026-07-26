import { HTTPClient, OpenRouter, type SDKOptions } from '@openrouter/sdk'

import { asQuery } from './text'
import type { Embedding } from './vector'

const REQUEST_TIMEOUT_MS = 60_000

/**
 * The SDK's default is an hour of backoff on 5XX, which would park a poll cycle
 * or a brief well past the point either is worth finishing. 429 is added
 * because the corpus is embedded in batches and rate limits are the failure
 * this path actually meets.
 */
const RETRY_CONFIG: SDKOptions['retryConfig'] = {
  strategy: 'backoff',
  backoff: {
    initialInterval: 500,
    maxInterval: 8_000,
    exponent: 2,
    maxElapsedTime: 30_000,
  },
  retryConnectionErrors: true,
}
const RETRY_CODES = ['429', '5XX']

export type EmbeddingConfig = {
  apiKey: string
  model: string
  /** Must equal the width of `articles.embedding`, or Postgres rejects the row. */
  dimensions: number
}

/**
 * One request for the whole batch — the endpoint returns a vector per input,
 * carrying the `index` it belongs to, which is what the sort restores.
 *
 * A width that disagrees with the column is caught here, because Postgres's
 * rejection names neither the model nor the requested dimensions.
 */
async function embed(
  inputs: string[],
  config: EmbeddingConfig,
  fetchImpl: typeof fetch,
): Promise<Embedding[]> {
  if (inputs.length === 0) return []

  const client = new OpenRouter({
    apiKey: config.apiKey,
    httpClient: new HTTPClient({ fetcher: fetchImpl }),
    timeoutMs: REQUEST_TIMEOUT_MS,
    retryConfig: RETRY_CONFIG,
  })

  const response = await client.embeddings.generate(
    {
      requestBody: {
        model: config.model,
        input: inputs,
        dimensions: config.dimensions,
      },
    },
    { retryCodes: RETRY_CODES },
  )

  if (typeof response === 'string') {
    throw new Error('embedding request returned a stream, expected a batch')
  }

  const { data } = response
  if (data.length !== inputs.length) {
    throw new Error(
      `expected ${inputs.length} embeddings, received ${data.length}`,
    )
  }

  const vectors = data
    .map((row, position) => ({ ...row, index: row.index ?? position }))
    .sort((a, b) => a.index - b.index)
    .map(({ embedding }) => {
      if (typeof embedding === 'string') {
        throw new Error(
          'embedding request returned base64, expected an array of floats',
        )
      }
      return embedding
    })

  const wrong = vectors.find((vector) => vector.length !== config.dimensions)
  if (wrong) {
    throw new Error(
      `${config.model} returned ${wrong.length} dimensions, expected ${config.dimensions} — the articles.embedding column will reject it`,
    )
  }

  return vectors
}

/** Documents are embedded as plain text. See `text.ts` for why that matters. */
export const embedDocuments = (
  texts: string[],
  config: EmbeddingConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<Embedding[]> => embed(texts, config, fetchImpl)

/**
 * Queries are wrapped in the retrieval instruction. Separate functions rather
 * than a flag so a caller cannot embed a query as a document by forgetting an
 * argument — the failure that would cause is silent and total.
 */
export async function embedQuery(
  query: string,
  config: EmbeddingConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<Embedding> {
  const [vector] = await embed([asQuery(query)], config, fetchImpl)
  if (!vector) throw new Error('embedding request returned no vector')
  return vector
}
