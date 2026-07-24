import { transportClient } from './client'
import { decodeJson, type ResponseSchema } from './decode'
import { toWireSchema } from './json-schema'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type Completion = {
  model: string
  finishReason: string | null
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
}

export type StructuredResult<T> = Completion & { value: T }

/**
 * A single schema-constrained completion. Tool-using loops go through
 * `@openrouter/agent`'s `callModel` instead; this transport exists only for the
 * no-tools structured transforms (prediction, summary).
 */
export type StructuredRequest<T> = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  responseSchema: ResponseSchema<T>
}

export async function chatCompletion<T>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  const result = await transportClient().chat.send({
    chatRequest: {
      model: request.model,
      messages: request.messages.map(({ role, content }) => ({
        role,
        content,
      })),
      temperature: request.temperature,
      stream: false,
      responseFormat: {
        type: 'json_schema' as const,
        jsonSchema: {
          name: request.responseSchema.name,
          schema: toWireSchema(request.responseSchema.schema),
          strict: true,
        },
      },
    },
  })

  if (!('choices' in result)) {
    throw new Error('Expected a non-streaming completion but received a stream')
  }

  const choice = result.choices[0]
  if (!choice) {
    throw new Error('OpenRouter returned no choices')
  }

  const completion: Completion = {
    model: result.model,
    finishReason: choice.finishReason,
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
    costUsd: result.usage?.cost ?? undefined,
  }

  const { content } = choice.message
  const text = typeof content === 'string' ? content : ''
  if (text.length === 0) {
    throw new Error(
      `OpenRouter returned no text content (finishReason: ${choice.finishReason})`,
    )
  }

  return { ...completion, value: decodeJson(text, request.responseSchema) }
}
