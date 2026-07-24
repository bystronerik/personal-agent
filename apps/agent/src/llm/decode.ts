import type { z } from 'zod'

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

/** Flattens Zod issues into one line, keyed by path, for error messages. */
const formatIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')

const preview = (text: string): string =>
  text.length <= 300 ? text : `${text.slice(0, 300)}…`

/** Tolerates a markdown-fenced response rather than failing on it. */
export function decodeJson<T>(
  raw: string,
  { name, schema }: ResponseSchema<T>,
): T {
  const jsonText = raw.match(FENCED_JSON)?.[1] ?? raw

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

  return parsed.data
}
