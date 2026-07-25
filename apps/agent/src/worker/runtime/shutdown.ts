export type Shutdown = {
  /**
   * A function rather than a boolean so there is nothing to snapshot: a caller
   * that destructures it still reads the one flag, and a pass awaiting Postgres
   * when the signal lands cannot resume against a stale copy and re-arm the jobs
   * shutdown had just stopped.
   */
  stopping: () => boolean
  /** Wraps a run so shutdown can wait for it rather than abandon it. */
  track<T>(work: Promise<T>): Promise<T>
  /** Registered where the thing it stops is created, so nothing live is unstoppable. */
  onStop(stop: () => void): void
  begin(signal: string): Promise<void>
}

export type ShutdownDeps = {
  disconnect: () => Promise<void>
}

/**
 * No `process.exit`: stopping the live jobs and awaiting what is in flight lets
 * the event loop drain on its own, so a SIGTERM mid-brief finishes and delivers
 * it instead of throwing away something already paid for.
 *
 * Returns closures rather than a class because `main` hands `track` and
 * `stopping` around as detached values.
 */
export function createShutdown({ disconnect }: ShutdownDeps): Shutdown {
  const inFlight = new Set<Promise<unknown>>()
  const stops: (() => void)[] = []
  let stopping = false

  return {
    stopping: () => stopping,

    track<T>(work: Promise<T>): Promise<T> {
      inFlight.add(work)
      return work.finally(() => {
        inFlight.delete(work)
      })
    },

    onStop(stop) {
      stops.push(stop)
    },

    async begin(signal) {
      stopping = true
      console.log(`\n${signal} — stopping`)
      for (const stop of stops) stop()
      if (inFlight.size > 0) {
        console.log(`Waiting for ${inFlight.size} run(s) in flight`)
        await Promise.allSettled([...inFlight])
      }
      await disconnect()
    },
  }
}
