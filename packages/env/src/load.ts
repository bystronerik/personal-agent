import { z } from 'zod'

import { blankAsAbsent } from './blank'

/** An environment variable's real name bound to the schema that validates it. */
export type EnvVar<T = unknown> = {
  readonly name: string
  readonly schema: z.ZodType<T>
}

/** Declares a variable once — its name, its validation, and (via the schema) its default. */
export function envVar<T>(name: string, schema: z.ZodType<T>): EnvVar<T> {
  return { name, schema }
}

type EnvSpec = Record<string, EnvVar>

type Parsed<S extends EnvSpec> = {
  [K in keyof S]: S[K] extends EnvVar<infer T> ? T : never
}

export type LoadEnvOptions = {
  /** Where raw values are read from — `process.env`, or static reads in a browser. */
  readonly source: Record<string, string | undefined>
  /** Names the config in the failure message, e.g. `The API`. */
  readonly subject: string
}

/**
 * Reads each variable from `source`, treats blanks as absent, and validates them
 * all at once — throwing a single message that lists every problem keyed by the
 * real environment-variable name.
 */
export function loadEnv<S extends EnvSpec>(
  spec: S,
  { source, subject }: LoadEnvOptions,
): Parsed<S> {
  const entries = Object.entries(spec)
  const shape = Object.fromEntries(
    entries.map(([field, variable]) => [field, variable.schema]),
  ) as z.ZodRawShape
  const raw = Object.fromEntries(
    entries.map(([field, variable]) => [
      field,
      blankAsAbsent(source[variable.name]),
    ]),
  )

  const parsed = z.object(shape).safeParse(raw)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => {
        const field = issue.path[0] as string | undefined
        const name = field ? spec[field]?.name : undefined
        return `  ${name ?? '(root)'} ${issue.message}`
      })
      .join('\n')
    throw new Error(
      `${subject} is not configured. Copy .env.example to .env and fix:\n${problems}`,
    )
  }

  return parsed.data as Parsed<S>
}
