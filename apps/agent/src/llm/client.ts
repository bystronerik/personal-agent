import { OpenRouter as AgentSDK } from '@openrouter/agent'
import { OpenRouter as TransportSDK } from '@openrouter/sdk'

import { loadAgentConfig } from '../config'

const memoize = <T>(create: () => T): (() => T) => {
  let cached: T | undefined
  return () => {
    cached ??= create()
    return cached
  }
}

/**
 * The slice of the loop client the agents actually use. Narrow on purpose: an
 * `AgentContext` carries one of these, so a test can drive a loop without a key.
 */
export type LoopClient = Pick<AgentSDK, 'callModel'>

/** `@openrouter/agent`, for the tool-using loops (research, orchestrator). */
export const agentClient = memoize(
  (): LoopClient => new AgentSDK({ apiKey: loadAgentConfig().apiKey }),
)

/** `@openrouter/sdk`, for single structured calls — reached only via `chatCompletion`. */
export const transportClient = memoize(
  () => new TransportSDK({ apiKey: loadAgentConfig().apiKey }),
)
