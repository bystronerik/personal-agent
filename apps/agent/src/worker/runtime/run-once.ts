import type { ScheduleDefinition } from '../scheduling/schedules'

export type RunOnceDeps = {
  find: (id: string) => Promise<ScheduleDefinition | undefined>
  /**
   * The raw runner, deliberately *not* the overlap-gated one: that gate logs a
   * failure and resolves, which would let `--once` report success on a brief
   * that never arrived.
   */
  run: (definition: ScheduleDefinition, now: Date) => Promise<void>
  track<T>(work: Promise<T>): Promise<T>
  disconnect: () => Promise<void>
}

/**
 * One schedule, fired now. Nothing live to stop, but the run is as paid for as a
 * scheduled one — so it is tracked, and the caller installs the signal handlers
 * before reaching this.
 */
export async function runOnce(id: string, deps: RunOnceDeps): Promise<void> {
  const schedule = await deps.find(id)
  if (!schedule) {
    throw new Error(`No enabled schedule with id ${id}`)
  }
  await deps.track(deps.run(schedule, new Date()))
  await deps.disconnect()
}
