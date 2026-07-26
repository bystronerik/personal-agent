import { OpenRouterError } from '@openrouter/sdk/models/errors'
import { describe, expect, it } from 'vitest'

import { type EmbeddingConfig, embedDocuments, embedQuery } from './client'
import { RETRIEVAL_INSTRUCTION } from './text'

const config: EmbeddingConfig = {
  apiKey: 'test-key',
  model: 'qwen/qwen3-embedding-8b',
  dimensions: 4,
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const respondWith = (body: unknown): typeof fetch =>
  (() => Promise.resolve(jsonResponse(body))) as unknown as typeof fetch

const embeddingsBody = (rows: { index?: number; embedding: number[] }[]) => ({
  object: 'list',
  model: config.model,
  data: rows.map((row) => ({ ...row, object: 'embedding' })),
})

const vectorsOf = (rows: number[][]) =>
  embeddingsBody(rows.map((embedding, index) => ({ index, embedding })))

const capturing = (body: unknown) => {
  const sent: unknown[] = []
  const fetchImpl = ((request: Request) => {
    sent.push(request.json())
    return Promise.resolve(jsonResponse(body))
  }) as unknown as typeof fetch
  return { sent: sent as Promise<unknown>[], fetchImpl }
}

describe('embedDocuments', () => {
  it('makes no request for an empty batch', async () => {
    let called = false
    const fetchImpl = (() => {
      called = true
      return Promise.resolve(jsonResponse({}))
    }) as unknown as typeof fetch

    expect(await embedDocuments([], config, fetchImpl)).toEqual([])
    expect(called).toBe(false)
  })

  /** The response carries the input each vector belongs to; order is not promised. */
  it('restores the input order from each vector index', async () => {
    const fetchImpl = respondWith(
      embeddingsBody([
        { index: 1, embedding: [9, 9, 9, 9] },
        { index: 0, embedding: [1, 1, 1, 1] },
      ]),
    )

    expect(
      await embedDocuments(['first', 'second'], config, fetchImpl),
    ).toEqual([
      [1, 1, 1, 1],
      [9, 9, 9, 9],
    ])
  })

  /** `index` is optional on the wire; position is the only fallback ordering. */
  it('falls back to response order when no index is sent', async () => {
    const fetchImpl = respondWith(
      embeddingsBody([
        { embedding: [1, 1, 1, 1] },
        { embedding: [9, 9, 9, 9] },
      ]),
    )

    expect(
      await embedDocuments(['first', 'second'], config, fetchImpl),
    ).toEqual([
      [1, 1, 1, 1],
      [9, 9, 9, 9],
    ])
  })

  it('sends document text unwrapped', async () => {
    const { sent, fetchImpl } = capturing(vectorsOf([[1, 2, 3, 4]]))

    await embedDocuments(['Policy rate held'], config, fetchImpl)

    expect(await sent[0]).toMatchObject({ input: ['Policy rate held'] })
  })

  it('asks for the width the column expects', async () => {
    const { sent, fetchImpl } = capturing(vectorsOf([[1, 2, 3, 4]]))

    await embedDocuments(['Policy rate held'], config, fetchImpl)

    expect(await sent[0]).toMatchObject({
      model: config.model,
      dimensions: 4,
    })
  })

  /**
   * A width that disagrees with `articles.embedding` is caught here, because
   * Postgres's rejection names neither the model nor the requested dimensions.
   */
  it('rejects a vector whose width would not fit the column', async () => {
    const fetchImpl = respondWith(vectorsOf([[1, 2, 3]]))

    await expect(embedDocuments(['text'], config, fetchImpl)).rejects.toThrow(
      /returned 3 dimensions, expected 4/,
    )
  })

  it('rejects a short batch rather than misaligning vectors', async () => {
    const fetchImpl = respondWith(vectorsOf([[1, 2, 3, 4]]))

    await expect(embedDocuments(['a', 'b'], config, fetchImpl)).rejects.toThrow(
      /expected 2 embeddings, received 1/,
    )
  })

  /** The SDK raises a typed error per status; both halves are what a log needs. */
  it('surfaces the API status and body', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response('no credits', { status: 402 }),
      )) as unknown as typeof fetch

    const error = await embedDocuments(['a'], config, fetchImpl).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(OpenRouterError)
    expect(error).toMatchObject({ statusCode: 402, body: 'no credits' })
  })
})

describe('embedQuery', () => {
  /**
   * The whole reason the two functions are separate. A bare query retrieves
   * plausible-looking nonsense, and nothing about the result says so.
   */
  it('wraps the query in the retrieval instruction', async () => {
    const { sent, fetchImpl } = capturing(vectorsOf([[1, 2, 3, 4]]))

    await embedQuery('oil and energy prices', config, fetchImpl)

    expect(await sent[0]).toMatchObject({
      input: [
        `Instruct: ${RETRIEVAL_INSTRUCTION}\nQuery: oil and energy prices`,
      ],
    })
  })

  it('returns the single vector rather than a list', async () => {
    const fetchImpl = respondWith(vectorsOf([[1, 2, 3, 4]]))

    expect(await embedQuery('anything', config, fetchImpl)).toEqual([
      1, 2, 3, 4,
    ])
  })
})
