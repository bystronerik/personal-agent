import { HttpError } from 'grammy'

/**
 * `HttpError.message` names only the method that failed; the reason worth
 * reading — ECONNREFUSED, ENOTFOUND, a timeout — is on `error`.
 */
const describe = (error: unknown): string => {
  if (error instanceof HttpError) {
    const cause = error.error
    return cause instanceof Error
      ? `${error.message} ${cause.message}`
      : error.message
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Misconfiguration is the common failure for these CLIs, and a stack trace
 * buries the one line that says which variable is missing.
 */
export async function runScript(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    console.error(describe(error))
    process.exitCode = 1
  }
}
