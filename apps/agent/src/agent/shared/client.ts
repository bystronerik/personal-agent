import { OpenRouter } from '@openrouter/agent'
import { requireEnv } from '../../utils/env'

let cached: OpenRouter | undefined

/**
 * The `@openrouter/agent` client used by the loop-running agents (research and
 * the orchestrator) via `callModel`. Single-shot structured calls go through
 * `structuredComplete` instead, which uses the transport in `llm/`.
 */
export function agentClient(): OpenRouter {
  if (!cached) {
    cached = new OpenRouter({
      apiKey: requireEnv(
        'OPENROUTER_API_KEY',
        'Copy .env.example to .env and add your key.',
      ),
    })
  }
  return cached
}
