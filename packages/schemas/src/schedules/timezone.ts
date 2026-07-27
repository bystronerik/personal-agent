import { z } from 'zod'

const isTimeZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * croner accepts an unknown zone silently rather than throwing, so a schedule
 * saved with one fires at some unintended hour instead of being rejected.
 */
export const TimeZoneSchema = z
  .string()
  .trim()
  .refine(isTimeZone, 'is not a valid IANA time zone')
