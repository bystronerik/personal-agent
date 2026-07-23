import { blankAsAbsent } from '@personal-agent/env'

/**
 * Reads an environment variable, treating blank values as absent. `.env` files
 * routinely carry empty placeholders (`OPENROUTER_MODEL=`), which `??` would
 * pass through as a valid empty string. The blank-is-absent rule is shared with
 * the schema loaders in `@personal-agent/env`.
 */
export function readEnv(name: string): string | undefined {
  return blankAsAbsent(process.env[name]) as string | undefined
}

export function requireEnv(name: string, hint: string): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`)
  }
  return value
}
