import { describe, expect, it, vi } from 'vitest'

import { createRegistry, type JobFactory, type ScheduleJob } from './registry'
import type { ScheduleDefinition } from './schedules'

const schedule = (
  overrides: Partial<ScheduleDefinition> = {},
): ScheduleDefinition => ({
  id: 'one',
  cron: '0 7 * * *',
  timezone: 'Europe/Prague',
  edition: 'morning',
  lastRunAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  ...overrides,
})

/** Records every job it hands out, so a rebuild is visible as stop + new job. */
const trackingFactory = (): { start: JobFactory; jobs: ScheduleJob[] } => {
  const jobs: ScheduleJob[] = []
  const start: JobFactory = () => {
    const job = { stop: vi.fn() }
    jobs.push(job)
    return job
  }
  return { start, jobs }
}

describe('createRegistry', () => {
  it('starts a job for each new schedule', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    const report = registry.reconcile([schedule(), schedule({ id: 'two' })])

    expect(report).toEqual({ added: ['one', 'two'], changed: [], removed: [] })
    expect(jobs).toHaveLength(2)
  })

  it('leaves an unchanged schedule alone', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    registry.reconcile([schedule()])
    const report = registry.reconcile([schedule()])

    expect(report).toEqual({ added: [], changed: [], removed: [] })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.stop).not.toHaveBeenCalled()
  })

  it('rebuilds a job whose pattern, zone, or edition changed', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    registry.reconcile([schedule()])
    const report = registry.reconcile([schedule({ cron: '0 8 * * *' })])

    expect(report.changed).toEqual(['one'])
    expect(jobs[0]?.stop).toHaveBeenCalledTimes(1)
    expect(jobs).toHaveLength(2)
  })

  /** A run writes `lastRunAt`; rebuilding on it would reset the pattern's phase. */
  it('does not rebuild a job because it has run', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    registry.reconcile([schedule()])
    const report = registry.reconcile([
      schedule({ lastRunAt: new Date('2026-07-26T05:00:00Z') }),
    ])

    expect(report).toEqual({ added: [], changed: [], removed: [] })
    expect(jobs).toHaveLength(1)
  })

  it('stops a job whose schedule is gone or disabled', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    registry.reconcile([schedule(), schedule({ id: 'two' })])
    const report = registry.reconcile([schedule({ id: 'two' })])

    expect(report.removed).toEqual(['one'])
    expect(jobs[0]?.stop).toHaveBeenCalledTimes(1)
    expect(jobs[1]?.stop).not.toHaveBeenCalled()
  })

  it('stops everything on shutdown', () => {
    const { start, jobs } = trackingFactory()
    const registry = createRegistry(start)

    registry.reconcile([schedule(), schedule({ id: 'two' })])
    registry.stopAll()

    for (const job of jobs) expect(job.stop).toHaveBeenCalledTimes(1)
    expect(registry.reconcile([schedule()]).added).toEqual(['one'])
  })
})
