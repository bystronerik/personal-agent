import { describe, expect, it } from 'vitest'

import { BriefSchema, ResearchFindingsSchema } from '../schema'
import { toWireSchema } from './json-schema'

/**
 * `EditionSchema` is shared with the admin API, whose schemas carry
 * `.meta({ id })` — and an id makes `z.toJSONSchema` emit a `$ref` into `$defs`,
 * which strict structured outputs reject and `stripUnsupported` does not flatten.
 * So the shared enum must reach the wire inline.
 */
describe('toWireSchema', () => {
  it.each([
    ['brief', BriefSchema],
    ['research findings', ResearchFindingsSchema],
  ])('emits the %s schema with no definitions to dereference', (_, schema) => {
    const wire = toWireSchema(schema)

    expect(wire.$defs).toBeUndefined()
    expect(JSON.stringify(wire)).not.toContain('$ref')
    expect(JSON.stringify(wire)).toContain('"morning"')
  })
})
