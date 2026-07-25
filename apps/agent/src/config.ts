import {
  loadEnv,
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
} from '@personal-agent/env'

const AGENT_ENV = {
  apiKey: OPENROUTER_API_KEY,
  model: OPENROUTER_MODEL,
}

export const loadAgentConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(AGENT_ENV, { source, subject: 'The agent' })

export type AgentConfig = ReturnType<typeof loadAgentConfig>
