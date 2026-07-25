import { parseArgs } from 'node:util'

export type WorkerArgs = {
  /** `--once <id>`: fire that schedule immediately and exit. */
  once?: string
}

/**
 * Read on call rather than at import, so importing the worker does not parse
 * whatever argv its importer happens to have.
 */
export function parseWorkerArgs(
  argv: string[] = process.argv.slice(2),
): WorkerArgs {
  const { values } = parseArgs({
    args: argv,
    options: { once: { type: 'string' } },
    allowPositionals: false,
  })
  return values
}
