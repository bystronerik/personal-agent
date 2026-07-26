import { CronPattern } from 'croner'

/**
 * Duplicated from `apps/agent`'s worker rather than shared: apps do not import
 * apps, and the alternative — a `packages/scheduling` extracted for two callers
 * that need different amounts of it — costs more than these twenty lines.
 *
 * croner throws on an unparseable pattern, which is the whole validation.
 */
export function isCronExpression(pattern: string): boolean {
  try {
    new CronPattern(pattern)
    return true
  } catch {
    return false
  }
}

/**
 * croner accepts an unknown `timezone` silently rather than throwing, so an
 * invalid zone would poll at some unintended hour instead of being rejected.
 */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone })
    return true
  } catch {
    return false
  }
}
