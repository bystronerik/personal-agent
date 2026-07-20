import { evalite } from 'evalite'

import { syntheticNews } from '../fixtures/synthetic-news'
import { COMPARED_MODELS } from '../llm/models'
import { chatCompletion } from '../llm/openrouter'
import { BRIEF_JSON_SCHEMA } from '../prompt/brief-json-schema'
import { buildBriefMessages } from '../prompt/brief-prompt'
import { parseBriefFromResponse } from '../prompt/parse-brief'
import { BRIEF_SCORERS, UnfencedOutput } from './scorers'

type Variant = { model: string; structured: boolean }

/**
 * The system prompt is identical across variants — only response_format changes,
 * so any difference is attributable to structured output alone.
 */
const VARIANTS: Array<{ name: string; input: Variant }> =
  COMPARED_MODELS.flatMap((model) => [
    { name: `${model} / prompt-only`, input: { model, structured: false } },
    { name: `${model} / json-schema`, input: { model, structured: true } },
  ])

evalite.each(VARIANTS)('brief', {
  data: [{ input: syntheticNews }],
  task: async (briefInput, { model, structured }) => {
    const result = await chatCompletion({
      model,
      messages: buildBriefMessages(briefInput),
      temperature: 0,
      ...(structured && {
        jsonSchema: { name: 'brief', schema: BRIEF_JSON_SCHEMA },
      }),
    })
    return parseBriefFromResponse(result.content)
  },
  scorers: [...BRIEF_SCORERS, UnfencedOutput],
  /**
   * The JSON failures this eval exists to catch are intermittent — temperature 0
   * is not deterministic across providers. A single trial cannot distinguish a
   * fix from a lucky sample.
   */
  trialCount: 3,
})
