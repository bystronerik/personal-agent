import { Cron } from 'croner'

import type { Shutdown } from '../runtime/shutdown'
import type { Pass } from './pass'
import type { ScheduleJob } from './registry'

/** Six fields: croner's optional seconds slot. Half a minute of edit latency. */
const RECONCILE_PATTERN = '*/30 * * * * *'

export type ReconcilerDeps = {
  pass: Pass
  shutdown: Pick<Shutdown, 'track' | 'stopping' | 'onStop'>
  /** Injected so a test can drive a tick without waiting on a timer. */
  startTimer?: (tick: () => Promise<void>) => ScheduleJob
}

const startCronTimer = (tick: () => Promise<void>): ScheduleJob =>
  new Cron(
    RECONCILE_PATTERN,
    {
      protect: true,
      catch: (error: unknown) =>
        console.error(
          'Reconcile failed — retrying on the next tick:',
          error instanceof Error ? error.message : error,
        ),
    },
    // Awaited by croner, so `protect` and `catch` see the whole pass.
    tick,
  )

/**
 * Arms the reconcile timer and registers its own stop hook, so a caller cannot
 * start a timer it has no way to stop. Both `stopping` checks live here, a few
 * lines apart: nothing is armed once a signal has landed, and a tick already
 * queued when one lands does nothing.
 */
export function startReconciler({
  pass,
  shutdown,
  startTimer = startCronTimer,
}: ReconcilerDeps): ScheduleJob | undefined {
  if (shutdown.stopping()) return undefined

  const timer = startTimer(async () => {
    if (shutdown.stopping()) return
    await shutdown.track(pass())
  })
  shutdown.onStop(() => timer.stop())
  return timer
}
