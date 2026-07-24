import { readEnv } from './client'

/** Overridable per run via OPENROUTER_MODEL. Browse ids at https://openrouter.ai/models */
export const DEFAULT_MODEL = 'x-ai/grok-4.5'

/** Models compared by `pnpm eval:models`. */
export const COMPARED_MODELS = [
  DEFAULT_MODEL,
  'minimax/minimax-m3',
  'deepseek/deepseek-v4-flash',
]

/** The one env-over-default rule: an explicit override wins, then the variable. */
export const resolveModel = (override?: string): string =>
  override ?? readEnv('OPENROUTER_MODEL') ?? DEFAULT_MODEL
