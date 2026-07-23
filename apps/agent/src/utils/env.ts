/**
 * Reads an environment variable, treating blank values as absent. `.env` files
 * routinely carry empty placeholders (`OPENROUTER_MODEL=`), which `??` would
 * pass through as a valid empty string.
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function requireEnv(name: string, hint: string): string {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`)
  }
  return value
}
