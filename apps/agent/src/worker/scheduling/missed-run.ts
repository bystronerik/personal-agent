/**
 * How late a missed occurrence may still be delivered. A 07:00 brief arriving at
 * 07:40 is worth having; the same brief at noon is worse than none.
 */
export const CATCHUP_GRACE_MINUTES = 45

const MINUTE_MS = 60_000

/**
 * Whether an occurrence passed while the worker was down and is still recent
 * enough to run. Comparing against `lastRunAt` is what makes this idempotent:
 * a run writes `lastRunAt` *after* the occurrence it was for, so a second
 * restart inside the same window will not fire it again — which is the only
 * reason catch-up is safe to leave on while restarting the worker all day.
 */
export function missedRun(
  previousOccurrence: Date | null,
  lastRunAt: Date | null,
  now: Date,
  graceMinutes: number = CATCHUP_GRACE_MINUTES,
): boolean {
  if (!previousOccurrence) return false
  if (lastRunAt && lastRunAt >= previousOccurrence) return false
  return (
    now.getTime() - previousOccurrence.getTime() <= graceMinutes * MINUTE_MS
  )
}
