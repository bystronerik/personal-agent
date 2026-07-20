import { z } from 'zod'
import { BriefSchema } from '../schema'

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

export const BRIEF_JSON_SCHEMA = stripUnsupported(
  z.toJSONSchema(BriefSchema, { target: 'draft-7' }),
) as Record<string, unknown>
