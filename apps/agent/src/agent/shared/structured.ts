import type {
  OpenResponsesResult,
  OutputItems,
  OutputReasoningItem,
} from '@openrouter/agent'

import { decodeJson, type ResponseSchema } from '../../llm/decode'
import { toWireSchema } from '../../llm/json-schema'
import type { AgentContext } from './run-context'

export type StructuredRequest<T> = {
  instructions: string
  input: string
  responseSchema: ResponseSchema<T>
}

const isReasoning = (item: OutputItems): item is OutputReasoningItem =>
  'type' in item && item.type === 'reasoning'

/**
 * The answer as some providers file it. `minimax/minimax-m3` returns a
 * schema-constrained response as a lone `reasoning` item with no message at
 * all, and the SDK reads text from message items only — so its output looked
 * empty. Read as a last resort: whatever comes back still has to parse.
 */
const reasoningTextOf = (response: OpenResponsesResult): string =>
  response.output
    .filter(isReasoning)
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text)
    .join('')

/**
 * One schema-constrained model call with no tools — the transform the prediction
 * and summary agents run, over the same `callModel` the loops use. Cost is read
 * from the response rather than wired to `onTurnEnd`, which the SDK fires only
 * after a follow-up request: a call with no tools never makes one.
 */
export async function structuredComplete<T>(
  ctx: AgentContext,
  { instructions, input, responseSchema }: StructuredRequest<T>,
): Promise<T> {
  const result = ctx.client.callModel({
    model: ctx.model,
    instructions,
    input,
    temperature: 0,
    text: {
      format: {
        type: 'json_schema',
        name: responseSchema.name,
        schema: toWireSchema(responseSchema.schema),
        strict: true,
      },
    },
  })

  const response = await result.getResponse()
  ctx.pool.record(response.usage?.cost)

  const text = (await result.getText()) || reasoningTextOf(response)
  if (text.length === 0) {
    throw new Error(
      `Model returned no ${responseSchema.name} content (status: ${response.status})`,
    )
  }

  return decodeJson(text, responseSchema)
}
