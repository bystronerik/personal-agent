import { type Brief, BriefSchema } from '../schema'

const FENCED_JSON = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/

export type ParsedBrief = {
  brief: Brief
  /** True when the model ignored the "no markdown fences" instruction. */
  wasFenced: boolean
}

export function parseBriefFromResponse(raw: string): ParsedBrief {
  const fenced = raw.match(FENCED_JSON)
  const jsonText = fenced?.[1] ?? raw

  let value: unknown
  try {
    value = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`Model output was not valid JSON: ${String(error)}`)
  }

  const parsed = BriefSchema.safeParse(value)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`Model output did not match the Brief schema: ${issues}`)
  }

  return { brief: parsed.data, wasFenced: fenced !== null }
}
