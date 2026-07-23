import type { OpenAPIObject } from '@nestjs/swagger'

type JsonRecord = Record<string, unknown>
type SchemaMap = Record<string, JsonRecord>

const DTO = 'Dto'
const SCHEMA_REF = /^#\/components\/schemas\/(.+)$/
const refTo = (name: string) => `#/components/schemas/${name}`

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const walk = (node: unknown, visit: (node: JsonRecord) => void): void => {
  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visit)
    }
    return
  }
  if (!isRecord(node)) {
    return
  }
  visit(node)
  for (const value of Object.values(node)) {
    walk(value, visit)
  }
}

/**
 * The id a component's schema was tagged with, recovered from the name it ended
 * up with: `ApiErrorDto` is the DTO class wrapping `ApiError`, and
 * `ApiErrorDtoErrorCode` is the `ErrorCode` schema nested inside it.
 */
const taggedId = (name: string, dtoNames: string[]): string | undefined => {
  if (name.endsWith(DTO)) {
    return name.slice(0, -DTO.length)
  }
  const owner = dtoNames.find((dtoName) => name.startsWith(dtoName))
  return owner && name.slice(owner.length)
}

/**
 * Restores the names `.meta({ id })` asked for, which `cleanupOpenApiDoc` only
 * applies when zod puts an `id` at the root of its JSON Schema — zod stopped
 * doing that in 4.4, leaving components named after the DTO class instead. A
 * name whose id is already taken keeps the one it has.
 */
const renameComponents = (schemas: SchemaMap): Map<string, string> => {
  const names = Object.keys(schemas)
  const dtoNames = names.filter((name) => name.endsWith(DTO))
  const taken = new Set(names)
  const renames = new Map<string, string>()

  for (const name of names) {
    const id = taggedId(name, dtoNames)
    const schema = schemas[name]
    if (!id || !schema || taken.has(id)) {
      continue
    }
    taken.add(id)
    renames.set(name, id)
    schemas[id] = schema
    delete schemas[name]
  }

  return renames
}

/**
 * Points a `$ref` at the renamed component. `cleanupOpenApiDoc` does this for
 * the `$ref` a response holds directly but not for one nested under `items`, so
 * an array response is left naming a component that no longer exists.
 */
const retargetRef = (
  node: JsonRecord,
  renames: Map<string, string>,
  names: Set<string>,
): void => {
  const name =
    typeof node.$ref === 'string' ? SCHEMA_REF.exec(node.$ref)?.[1] : undefined
  if (!name) {
    return
  }
  const renamed = renames.get(name)
  if (renamed) {
    node.$ref = refTo(renamed)
    return
  }
  if (names.has(name)) {
    return
  }
  const repaired = name.replace(DTO, '')
  if (names.has(repaired)) {
    node.$ref = refTo(repaired)
  }
}

/**
 * Reconciles Zod 4's JSON Schema output with what an OpenAPI 3.0 document may
 * say and what orval understands. Applied to every document the API produces,
 * so `/docs` and the emitted spec cannot drift apart.
 */
export function postProcessOpenApiDoc(doc: OpenAPIObject): OpenAPIObject {
  const schemas = (doc.components?.schemas ?? {}) as SchemaMap

  // `.meta({ id })` leaves the id behind on the component it named.
  for (const schema of Object.values(schemas)) {
    delete schema.id
  }

  walk(doc, (node) => {
    // `z.record()` describes its key type here; OpenAPI has no equivalent.
    delete node.propertyNames
    // OpenAPI 3.0 spells "any additional property" as `true`, not `{}`.
    if (isRecord(node.additionalProperties)) {
      if (Object.keys(node.additionalProperties).length === 0) {
        node.additionalProperties = true
      }
    }
  })

  const renames = renameComponents(schemas)
  const names = new Set(Object.keys(schemas))
  walk(doc, (node) => retargetRef(node, renames, names))

  return doc
}
