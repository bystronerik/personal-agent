import { parseArgs } from 'node:util'

import { Cron } from 'croner'

import { loadIngestConfig } from './config'
import { disconnectDb, ingestDb } from './db'
import { ensureSources, type SourceDefinition } from './feeds/sources'
import { createValidatorStore } from './feeds/validators'
import { type PollOutcome, pollSource } from './ingest/poll'
import { sweepExpired } from './ingest/retention'
import { createShutdown } from './runtime/shutdown'
import { listenForShutdown } from './runtime/signals'

const SWEEP_PATTERN = '17 * * * *'

const describe = (outcome: PollOutcome): string => {
  if (outcome.status === 'failed') return `${outcome.source}: ${outcome.error}`
  if (outcome.status === 'not-modified') return `${outcome.source}: 304`
  return `${outcome.source}: ${outcome.inserted} new (${outcome.parsed} parsed, ${outcome.fresh} unseen, ${outcome.skipped} unusable, ${outcome.stale} stale)`
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { once: { type: 'boolean', default: false } },
    allowPositionals: false,
  })

  const config = loadIngestConfig()
  const db = ingestDb()
  const shutdown = createShutdown({ disconnect: disconnectDb })

  /**
   * Installed before the first poll — `--once` included — so a rolling restart
   * cannot discard articles already fetched and paid to embed.
   */
  listenForShutdown(shutdown)

  const validators = createValidatorStore()

  /**
   * croner's own `protect` sees only the job it is set on, and nothing else here
   * fires a source, but a feed slower than its own interval would still overlap
   * itself. One running set covers every path that polls.
   */
  const running = new Set<string>()

  const poll = async (source: SourceDefinition): Promise<void> => {
    if (shutdown.stopping() || running.has(source.id)) return
    running.add(source.id)
    try {
      const outcome = await shutdown.track(
        pollSource({ db, config, validators }, source),
      )
      console.log(describe(outcome))
    } finally {
      running.delete(source.id)
    }
  }

  const sweep = async (): Promise<void> => {
    if (shutdown.stopping()) return
    const deleted = await shutdown.track(sweepExpired(db, config.retentionDays))
    if (deleted > 0) {
      console.log(`Retention: deleted ${deleted} article(s)`)
    }
  }

  const sources = await ensureSources(db)

  if (values.once) {
    console.log(`Polling ${sources.length} source(s) once`)
    for (const source of sources) await poll(source)
    await sweep()
    await disconnectDb()
    return
  }

  const jobs = sources.map(
    (source) =>
      new Cron(source.cron, { timezone: source.timezone, catch: true }, () =>
        poll(source),
      ),
  )
  const sweeper = new Cron(SWEEP_PATTERN, { catch: true }, sweep)
  shutdown.onStop(() => {
    for (const job of jobs) job.stop()
    sweeper.stop()
  })

  console.log(
    `Ingest running — ${sources.length} sources, sweeping past ${config.retentionDays} days hourly`,
  )
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  await disconnectDb()
  process.exitCode = 1
}
