import type { z } from 'zod'
import { formatIssues } from '../utils/zod'

const FENCED_JSON = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/

/**
 * Pairs the wire constraint with the runtime validation. One Zod schema drives
 * both, so the shape the model is asked for cannot drift from the shape that is
 * enforced on the way back.
 */
export type ResponseSchema<T> = {
  /** Identifies the schema on the wire and in decode errors. */
  name: string
  schema: z.ZodType<T>
}

export type Decoded<T> = {
  value: T
  /** True when the model ignored the "no markdown fences" instruction. */
  wasFenced: boolean
}

const preview = (text: string): string =>
  text.length <= 300 ? text : `${text.slice(0, 300)}…`

export function decodeJson<T>(
  raw: string,
  { name, schema }: ResponseSchema<T>,
): Decoded<T> {
  const fenced = raw.match(FENCED_JSON)
  const jsonText = fenced?.[1] ?? raw

  let value: unknown
  try {
    value = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(
      `Model output was not valid JSON: ${String(error)}\n--- raw output ---\n${preview(raw)}`,
    )
  }

  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new Error(
      `Model output did not match the ${name} schema: ${formatIssues(parsed.error)}`,
    )
  }

  return { value: parsed.data, wasFenced: fenced !== null }
}
