import { describe, expect, it } from 'vitest'

import { CronExpressionSchema } from '@personal-agent/schemas/schedules'

import { isCronExpression } from './pattern-checks'

/**
 * The admin API's cron grammar lives in `packages/schemas`, which may not depend
 * on croner. This package is the only one holding both, so the subset's
 * one-directional contract is pinned here: whatever the API accepts, the worker
 * can fire. The reverse does not hold, and the rejected list says so.
 */
const ACCEPTED = [
  '0 7 * * *',
  '30 7 * * 1-5',
  '* * * * *',
  '*/15 * * * *',
  '0 0 1,15 * *',
  '0 0 * * MON-FRI',
  '0 0 * * mon,wed,fri',
  '0 9 * JAN-MAR *',
  '0 0 * * 0-7',
  '0 0 * * MON-SUN',
  '1-59/2 * * * *',
  '*/60 * * * *',
  '00 07 * * *',
  '  0 7 * * *  ',
]

const REJECTED = [
  'every morning',
  '0 99 * * *',
  '*/30 * * * * *',
  '0 7 * * * 2026',
  '@daily',
  '0 0 L * *',
  '0 0 * * 5#2',
  '0 0 15W * *',
  '0 0 * * +MON',
  '0 0 ? * *',
  '5/2 * * * *',
  '*/0 * * * *',
  '*/90 * * * *',
  '5-2 * * * *',
  '0 0 * * 8',
  '0 0 0 * *',
  '0 7 * *',
  '',
]

describe('the admin API cron subset', () => {
  it.each(ACCEPTED)('accepts %j, and croner parses it', (pattern) => {
    expect(CronExpressionSchema.safeParse(pattern).success).toBe(true)
    expect(isCronExpression(pattern)).toBe(true)
  })

  it.each(REJECTED)('rejects %j', (pattern) => {
    expect(CronExpressionSchema.safeParse(pattern).success).toBe(false)
  })
})
