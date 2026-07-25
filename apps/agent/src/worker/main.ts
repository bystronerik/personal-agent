import { disconnectDb } from './db'
import { telegramConfig } from './delivery/deliver'
import { runScheduledBrief } from './delivery/run'
import { parseWorkerArgs } from './runtime/cli-args'
import { runOnce } from './runtime/run-once'
import { createShutdown } from './runtime/shutdown'
import { listenForShutdown } from './runtime/signals'
import { createCatchUpLedger } from './scheduling/catch-up-ledger'
import { createPass } from './scheduling/pass'
import { startReconciler } from './scheduling/reconciler'
import { createRegistry } from './scheduling/registry'
import { createRunOccurrence } from './scheduling/run-occurrence'
import { findSchedule, listEnabledSchedules } from './scheduling/schedules'
import { startJob } from './scheduling/start-job'

async function main(): Promise<void> {
  // Fail while someone is watching rather than at the first fire.
  telegramConfig()

  const shutdown = createShutdown({ disconnect: disconnectDb })
  // Above the `--once` branch: every path below this can fire a paid brief.
  listenForShutdown(shutdown)

  const { once } = parseWorkerArgs()
  if (once !== undefined) {
    await runOnce(once, {
      find: findSchedule,
      run: runScheduledBrief,
      track: shutdown.track,
      disconnect: disconnectDb,
    })
    return
  }

  const fire = createRunOccurrence({
    run: runScheduledBrief,
    track: shutdown.track,
  })
  const registry = createRegistry((definition) =>
    startJob(definition, (fired) => fire(fired, new Date())),
  )
  shutdown.onStop(() => registry.stopAll())

  const pass = createPass({
    registry,
    load: listEnabledSchedules,
    ledger: createCatchUpLedger(),
    fire,
    stopping: shutdown.stopping,
    now: () => new Date(),
  })

  const definitions = await pass()
  if (definitions.length === 0) {
    console.log('No enabled schedules — seed one with `pnpm seed-schedule`')
  }

  startReconciler({ pass, shutdown })
  console.log('Worker running. Ctrl-C to stop.')
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  await disconnectDb()
  process.exitCode = 1
}
