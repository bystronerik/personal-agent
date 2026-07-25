import type { CatchUpLedger } from './catch-up-ledger'
import { missedRun } from './missed-run'
import { previousOccurrence } from './occurrences'
import type { RunOccurrence } from './run-occurrence'
import type { ScheduleDefinition } from './schedules'

export type CatchUpDeps = {
  ledger: CatchUpLedger
  fire: RunOccurrence
  stopping: () => boolean
  /**
   * A function, not a `Date`, because it is read once per *iteration*: a brief
   * takes minutes, so a clock hoisted out of the loop would measure the grace
   * window from a moment that has already passed.
   */
  now: () => Date
}

/** Fires anything missed inside the grace window, each on its own clock. */
export async function catchUp(
  definitions: ScheduleDefinition[],
  { ledger, fire, stopping, now }: CatchUpDeps,
): Promise<void> {
  ledger.keepOnly(definitions.map((definition) => definition.id))

  for (const definition of definitions) {
    if (stopping()) return
    const at = now()

    const occurrence = previousOccurrence(definition, at)
    if (!occurrence) continue
    // A row younger than its own last occurrence missed nothing: it did not exist.
    const since = definition.lastRunAt ?? definition.createdAt
    if (!missedRun(occurrence, since, at)) continue
    if (!ledger.claim(definition.id, occurrence, at)) continue

    console.log(`[${definition.id}] missed its last occurrence — running now`)
    await fire(definition, at)
  }
}
