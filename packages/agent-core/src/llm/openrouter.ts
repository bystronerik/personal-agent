import { OpenRouter } from '@openrouter/sdk'
import { requireEnv } from '../utils/env'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type JsonSchemaFormat = {
  name: string
  schema: Record<string, unknown>
}

export type ChatCompletionRequest = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  /** Constrains decoding to the schema, making malformed JSON impossible. */
  jsonSchema?: JsonSchemaFormat
}

export type ChatCompletionResult = {
  content: string
  model: string
  finishReason: string | null
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
}

function createClient(): OpenRouter {
  const apiKey = requireEnv(
    'OPENROUTER_API_KEY',
    'Copy .env.example to .env and add your key.',
  )
  return new OpenRouter({ apiKey })
}

export async function chatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const result = await createClient().chat.send({
    chatRequest: {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      stream: false,
      ...(request.jsonSchema && {
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: request.jsonSchema.name,
            schema: request.jsonSchema.schema,
            strict: true,
          },
        },
      }),
    },
  })

  if (!('choices' in result)) {
    throw new Error('Expected a non-streaming completion but received a stream')
  }

  const choice = result.choices[0]
  if (!choice) {
    throw new Error('OpenRouter returned no choices')
  }

  const { content } = choice.message
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(
      `OpenRouter returned no text content (finishReason: ${choice.finishReason})`,
    )
  }

  return {
    content,
    model: result.model,
    finishReason: choice.finishReason,
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
    costUsd: result.usage?.cost ?? undefined,
  }
}
