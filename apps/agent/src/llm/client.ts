import { OpenRouter as AgentSDK } from '@openrouter/agent'

import { loadAgentConfig } from '../config'

const memoize = <T>(create: () => T): (() => T) => {
  let cached: T | undefined
  return () => {
    cached ??= create()
    return cached
  }
}

/**
 * The slice of the client the agents actually use. Narrow on purpose: an
 * `AgentContext` carries one of these, so a test can drive a loop without a key.
 */
export type LoopClient = Pick<AgentSDK, 'callModel'>

/** `@openrouter/agent` — every model call, tool-using loop or structured transform. */
export const agentClient = memoize(
  (): LoopClient => new AgentSDK({ apiKey: loadAgentConfig().apiKey }),
)
