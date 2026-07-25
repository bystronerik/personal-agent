import { DEFAULT_OPENROUTER_MODEL } from '@personal-agent/env'

import { loadAgentConfig } from '../config'

/** Models compared by `pnpm eval:models`. Browse ids at https://openrouter.ai/models */
export const COMPARED_MODELS = [
  DEFAULT_OPENROUTER_MODEL,
  'z-ai/glm-4.7-flash',
  'deepseek/deepseek-v4-flash',
]

/** The one env-over-default rule: an explicit override wins, then the variable. */
export const resolveModel = (override?: string): string =>
  override ?? loadAgentConfig().model
