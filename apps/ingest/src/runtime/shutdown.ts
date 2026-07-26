export type Shutdown = {
  /**
   * A function rather than a boolean so there is nothing to snapshot: a pass
   * awaiting Postgres when the signal lands cannot resume against a stale copy
   * and re-arm the jobs shutdown had just stopped.
   */
  stopping: () => boolean
  track<T>(work: Promise<T>): Promise<T>
  onStop(stop: () => void): void
  begin(signal: string): Promise<void>
}

export type ShutdownDeps = {
  disconnect: () => Promise<void>
}

/**
 * No `process.exit`: stopping the live jobs and awaiting what is in flight lets
 * the event loop drain on its own, so a signal mid-poll finishes storing what it
 * already fetched and paid to embed.
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
        console.log(`Waiting for ${inFlight.size} poll(s) in flight`)
        await Promise.allSettled([...inFlight])
      }
      await disconnect()
    },
  }
}
