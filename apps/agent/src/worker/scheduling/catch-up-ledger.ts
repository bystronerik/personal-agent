const MINUTE_MS = 60_000

/**
 * How often a missed occurrence may be re-attempted, and how many times. A run
 * that fails leaves `lastRunAt` untouched — that is what makes catch-up retry it
 * — so without a ledger every reconcile pass would regenerate the same paid
 * brief half a minute apart until the grace window closed.
 */
export const CATCHUP_ATTEMPTS = 3
export const CATCHUP_RETRY_MINUTES = 5

export type CatchUpLedger = {
  /** Whether the occurrence may be attempted now, recording it if so. */
  claim(id: string, occurrence: Date, now: Date): boolean
  /** Forgets schedules that are no longer live, so the ledger cannot grow. */
  keepOnly(ids: Iterable<string>): void
}

export function createCatchUpLedger(
  attempts: number = CATCHUP_ATTEMPTS,
  retryMinutes: number = CATCHUP_RETRY_MINUTES,
): CatchUpLedger {
  const tried = new Map<
    string,
    { occurrence: number; count: number; at: number }
  >()

  return {
    claim(id, occurrence, now) {
      const record = tried.get(id)
      if (!record || record.occurrence !== occurrence.getTime()) {
        tried.set(id, {
          occurrence: occurrence.getTime(),
          count: 1,
          at: now.getTime(),
        })
        return true
      }
      if (record.count >= attempts) return false
      if (now.getTime() - record.at < retryMinutes * MINUTE_MS) return false
      record.count += 1
      record.at = now.getTime()
      return true
    },

    keepOnly(ids) {
      const live = new Set(ids)
      for (const id of tried.keys()) {
        if (!live.has(id)) tried.delete(id)
      }
    },
  }
}
