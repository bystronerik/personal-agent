import { type CatchUpDeps, catchUp } from './catch-up'
import { type ReconcileDeps, reconcile } from './reconcile'
import type { ScheduleDefinition } from './schedules'

export type Pass = () => Promise<ScheduleDefinition[]>

/**
 * The intersection is deliberate: a dependency added to either half becomes a
 * compile error where the pass is wired, rather than a field quietly missing.
 */
export type PassDeps = ReconcileDeps & CatchUpDeps

/**
 * Reconcile, then catch up. Catch-up rides the same timer rather than running
 * only at boot: a run that failed leaves `lastRunAt` untouched, and retrying it
 * while the brief is still worth having is the whole point of the grace window.
 */
export function createPass(deps: PassDeps): Pass {
  return async () => {
    const definitions = await reconcile(deps)
    await catchUp(definitions, deps)
    return definitions
  }
}
