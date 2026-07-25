import { describe, expect, it } from 'vitest'

import {
  CATCHUP_ATTEMPTS,
  CATCHUP_RETRY_MINUTES,
  createCatchUpLedger,
} from './catch-up-ledger'

describe('createCatchUpLedger', () => {
  const occurrence = new Date('2026-07-26T05:00:00Z')
  const at = (minutes: number): Date =>
    new Date(occurrence.getTime() + minutes * 60_000)

  it('claims an occurrence it has not seen before', () => {
    const ledger = createCatchUpLedger()
    expect(ledger.claim('one', occurrence, at(1))).toBe(true)
  })

  /** Reconcile runs every half minute; a failed brief must not re-run that fast. */
  it('refuses a retry inside the cooldown', () => {
    const ledger = createCatchUpLedger()
    ledger.claim('one', occurrence, at(1))
    expect(ledger.claim('one', occurrence, at(1.5))).toBe(false)
    expect(ledger.claim('one', occurrence, at(1 + CATCHUP_RETRY_MINUTES))).toBe(
      true,
    )
  })

  it('gives up on one occurrence after its attempts are spent', () => {
    const ledger = createCatchUpLedger()
    for (let attempt = 0; attempt < CATCHUP_ATTEMPTS; attempt += 1) {
      expect(ledger.claim('one', occurrence, at(attempt * 10))).toBe(true)
    }
    expect(ledger.claim('one', occurrence, at(CATCHUP_ATTEMPTS * 10))).toBe(
      false,
    )
  })

  it('starts over for the next occurrence', () => {
    const ledger = createCatchUpLedger(1)
    ledger.claim('one', occurrence, at(1))
    expect(ledger.claim('one', occurrence, at(30))).toBe(false)
    const tomorrow = new Date(occurrence.getTime() + 24 * 60 * 60_000)
    expect(ledger.claim('one', tomorrow, at(24 * 60 + 1))).toBe(true)
  })

  it('forgets a schedule that is no longer live', () => {
    const ledger = createCatchUpLedger(1)
    ledger.claim('one', occurrence, at(1))
    ledger.keepOnly(['two'])
    expect(ledger.claim('one', occurrence, at(2))).toBe(true)
  })
})
