import type { ReconcileReport, Registry } from './registry'
import type { ScheduleDefinition } from './schedules'

export type ScheduleLoader = () => Promise<ScheduleDefinition[]>

export type ReconcileDeps = {
  registry: Registry
  load: ScheduleLoader
  stopping: () => boolean
}

/** `undefined` when nothing moved, which is what keeps a quiet pass silent. */
const describeReport = (report: ReconcileReport): string | undefined => {
  const parts = [
    report.added.length && `+${report.added.length}`,
    report.changed.length && `~${report.changed.length}`,
    report.removed.length && `-${report.removed.length}`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Diffs the table against the live jobs. The `stopping` check sits after the
 * query because a pass that was awaiting Postgres when the signal landed would
 * otherwise read every row as new and re-arm the jobs shutdown had just stopped.
 */
export async function reconcile({
  registry,
  load,
  stopping,
}: ReconcileDeps): Promise<ScheduleDefinition[]> {
  const definitions = await load()
  if (stopping()) return []

  const report = registry.reconcile(definitions)
  const summary = describeReport(report)
  if (summary) {
    console.log(`Schedules reconciled: ${summary} (${definitions.length} live)`)
  }
  return definitions
}
