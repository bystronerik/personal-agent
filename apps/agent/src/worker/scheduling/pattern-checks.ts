import { CronPattern } from 'croner'

/**
 * croner throws on an unparseable pattern, which is the whole validation — no
 * hand-rolled field parser, and the same library that fires a job decides
 * whether its pattern is firable.
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
 * invalid zone would fire at some unintended hour instead of being rejected.
 * Constructing a formatter is the check.
 */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone })
    return true
  } catch {
    return false
  }
}
