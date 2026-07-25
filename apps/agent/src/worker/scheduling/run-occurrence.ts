import type { ScheduleDefinition } from './schedules'

export type RunOccurrence = (
  definition: ScheduleDefinition,
  now: Date,
) => Promise<void>

export type RunOccurrenceDeps = {
  run: (definition: ScheduleDefinition, now: Date) => Promise<void>
  track<T>(work: Promise<T>): Promise<T>
}

/**
 * One run per schedule at a time. Overlap protection has to be ours rather than
 * croner's `protect`, which sees only its own job: catch-up fires the same
 * schedule from outside it, and a brief takes minutes. Both fire paths share one
 * instance of this, which is what makes the guard cover them.
 *
 * `track` is folded in rather than left to each call site: a fire site that
 * forgets it hands shutdown nothing to wait for, and a paid brief is discarded
 * with no failing test to show for it.
 */
export function createRunOccurrence({
  run,
  track,
}: RunOccurrenceDeps): RunOccurrence {
  const running = new Set<string>()

  const fire = async (
    definition: ScheduleDefinition,
    now: Date,
  ): Promise<void> => {
    if (running.has(definition.id)) {
      console.warn(
        `[${definition.id}] already running — skipping this occurrence`,
      )
      return
    }
    running.add(definition.id)
    try {
      await run(definition, now)
    } catch (error) {
      console.error(
        `[${definition.id}] run failed:`,
        error instanceof Error ? error.message : error,
      )
    } finally {
      running.delete(definition.id)
    }
  }

  return (definition, now) => track(fire(definition, now))
}
