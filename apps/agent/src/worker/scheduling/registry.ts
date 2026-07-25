import type { ScheduleDefinition } from './schedules'

/** The slice of a croner job the registry needs — narrow, so a test needs no timers. */
export type ScheduleJob = {
  stop(): void
}

export type JobFactory = (definition: ScheduleDefinition) => ScheduleJob

export type ReconcileReport = {
  added: string[]
  /** Stopped and rebuilt: a pattern, zone, or edition changed under a live job. */
  changed: string[]
  removed: string[]
}

/**
 * What decides whether a live job still matches its row. `lastRunAt` is
 * deliberately absent — the worker writes it after every run, and rebuilding a
 * job on that would reset the pattern's phase on every fire.
 */
const fingerprint = (definition: ScheduleDefinition): string =>
  `${definition.cron}|${definition.timezone}|${definition.edition}`

export type Registry = {
  /** Diffs rows against the live jobs, starting, rebuilding, and stopping as needed. */
  reconcile(definitions: ScheduleDefinition[]): ReconcileReport
  stopAll(): void
}

/**
 * The only scheduling logic that is ours: croner holds the jobs and fires them,
 * so all that is left is keeping the live set equal to what the table says.
 * Running it on a timer is what makes an edited row take effect without a
 * restart, and what a future `LISTEN/NOTIFY` would replace.
 */
export function createRegistry(start: JobFactory): Registry {
  const live = new Map<string, { fingerprint: string; job: ScheduleJob }>()

  return {
    reconcile(definitions) {
      const report: ReconcileReport = { added: [], changed: [], removed: [] }
      const seen = new Set<string>()

      for (const definition of definitions) {
        seen.add(definition.id)
        const print = fingerprint(definition)
        const existing = live.get(definition.id)
        if (existing?.fingerprint === print) continue

        if (existing) {
          existing.job.stop()
          report.changed.push(definition.id)
        } else {
          report.added.push(definition.id)
        }
        live.set(definition.id, { fingerprint: print, job: start(definition) })
      }

      for (const [id, entry] of live) {
        if (seen.has(id)) continue
        entry.job.stop()
        live.delete(id)
        report.removed.push(id)
      }

      return report
    },

    stopAll() {
      for (const entry of live.values()) entry.job.stop()
      live.clear()
    },
  }
}
