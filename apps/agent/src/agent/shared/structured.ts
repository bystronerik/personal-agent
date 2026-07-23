import type { ResponseSchema } from '../../llm/decode'
import {
  type ChatMessage,
  chatCompletion,
  type StructuredResult,
} from '../../llm/openrouter'

export type StructuredRequest<T> = {
  model: string
  messages: ChatMessage[]
  schema: ResponseSchema<T>
  temperature?: number
}

/**
 * One schema-constrained model call with no tools — the transform the
 * prediction and summary agents run.
 */
export function structuredComplete<T>({
  model,
  messages,
  schema,
  temperature,
}: StructuredRequest<T>): Promise<StructuredResult<T>> {
  return chatCompletion({
    model,
    messages,
    temperature,
    responseSchema: schema,
  })
}
