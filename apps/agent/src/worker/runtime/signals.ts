import type { Shutdown } from './shutdown'

/**
 * `once`, not `on`: a second signal takes Node's default path, which is the way
 * out of a drain that is taking too long.
 *
 * The handler catches because `begin` disconnects Postgres, which can reject if
 * the connection is already gone — unhandled, that would turn a clean drain into
 * a crash exit.
 */
export function listenForShutdown(shutdown: Pick<Shutdown, 'begin'>): void {
  const handle = (signal: string) => (): void => {
    shutdown.begin(signal).catch((error: unknown) => {
      console.error(
        'Shutdown failed:',
        error instanceof Error ? error.message : error,
      )
      process.exitCode = 1
    })
  }

  process.once('SIGINT', handle('SIGINT'))
  process.once('SIGTERM', handle('SIGTERM'))
}
