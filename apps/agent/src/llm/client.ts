import { OpenRouter as AgentSDK } from '@openrouter/agent'
import { OpenRouter as TransportSDK } from '@openrouter/sdk'
import { blankAsAbsent } from '@personal-agent/env'

/**
 * Reads an environment variable, treating blank values as absent. `.env` files
 * routinely carry empty placeholders (`OPENROUTER_MODEL=`), which `??` would
 * pass through as a valid empty string. The blank-is-absent rule is shared with
 * the schema loaders in `@personal-agent/env`.
 */
export const readEnv = (name: string): string | undefined =>
  blankAsAbsent(process.env[name])

function requireEnv(name: string, hint: string): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`)
  }
  return value
}

const memoize = <T>(create: () => T): (() => T) => {
  let cached: T | undefined
  return () => {
    cached ??= create()
    return cached
  }
}

const apiKey = (): string =>
  requireEnv(
    'OPENROUTER_API_KEY',
    'Copy .env.example to .env and add your key.',
  )

/**
 * The slice of the loop client the agents actually use. Narrow on purpose: an
 * `AgentContext` carries one of these, so a test can drive a loop without a key.
 */
export type LoopClient = Pick<AgentSDK, 'callModel'>

/** `@openrouter/agent`, for the tool-using loops (research, orchestrator). */
export const agentClient = memoize(
  (): LoopClient => new AgentSDK({ apiKey: apiKey() }),
)

/** `@openrouter/sdk`, for single structured calls — reached only via `chatCompletion`. */
export const transportClient = memoize(
  () => new TransportSDK({ apiKey: apiKey() }),
)
