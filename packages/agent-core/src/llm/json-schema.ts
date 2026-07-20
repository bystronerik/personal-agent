import { z } from 'zod'

/**
 * Strict structured outputs reject these, but Zod still enforces them when the
 * response is parsed. The wire schema therefore guarantees shape (fields, types,
 * enums, valid JSON) while Zod guarantees bounds (lengths, ranges).
 */
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'maximum',
  'maxItems',
  'maxLength',
  'minimum',
  'minItems',
  'minLength',
  'multipleOf',
])

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported)
  if (node === null || typeof node !== 'object') return node

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !UNSUPPORTED_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupported(value)]),
  )
}

/** Converts a Zod schema to the JSON Schema dialect the wire accepts. */
export function toWireSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(
    z.toJSONSchema(schema, { target: 'draft-7' }),
  ) as Record<string, unknown>
}
