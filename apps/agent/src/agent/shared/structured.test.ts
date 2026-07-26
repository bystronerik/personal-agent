import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { syntheticNews } from '../../fixtures/synthetic-news'
import type { LoopClient } from '../../llm/client'
import type { ResponseSchema } from '../../llm/decode'
import { fixtureProvider } from '../../sources/fixture'
import { createBlackboard } from './blackboard'
import { createPool, DEFAULT_BUDGET } from './budget'
import type { AgentContext } from './run-context'
import { structuredComplete } from './structured'

const PROBE: ResponseSchema<{ ok: boolean }> = {
  name: 'probe',
  schema: z.object({ ok: z.boolean() }),
}

/** The one field asserted here; the real request is the SDK's whole shape. */
type SentRequest = { sessionId?: string }

/**
 * `LoopClient` is one method wide, so a fake needs no key — and the response
 * only has to satisfy what `structuredComplete` reads off it.
 */
const recordingClient = () => {
  const sent: SentRequest[] = []
  const client = {
    callModel: (request: SentRequest) => {
      sent.push(request)
      return {
        getResponse: async () => ({ status: 'completed', usage: { cost: 0 } }),
        getText: async () => '{"ok":true}',
      }
    },
  } as unknown as LoopClient
  return { client, sent }
}

const contextWith = (client: LoopClient, sessionId: string): AgentContext => ({
  model: 'test/model',
  board: createBlackboard(syntheticNews),
  pool: createPool(),
  budget: DEFAULT_BUDGET,
  client,
  sources: fixtureProvider([]),
  sessionId,
})

describe('structuredComplete', () => {
  it('sends the run session id with the call', async () => {
    const { client, sent } = recordingClient()
    const sessionId = 'brief-morning-2026-07-25T06-00-00Z-abc123'

    await structuredComplete(contextWith(client, sessionId), {
      instructions: 'probe',
      input: 'probe',
      responseSchema: PROBE,
    })

    expect(sent.map((request) => request.sessionId)).toEqual([sessionId])
  })
})
