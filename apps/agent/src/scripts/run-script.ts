/**
 * Misconfiguration is the common failure for these CLIs, and a stack trace
 * buries the one line that says which variable is missing.
 */
export async function runScript(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
