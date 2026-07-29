import { describe, expect, it } from 'vitest'

import { chooseDestination, type DeliverySettings } from './recipient'

const settings = (
  overrides: Partial<DeliverySettings> = {},
): DeliverySettings => ({
  email: 'reader@example.com',
  emailVerified: true,
  emailSuspendedAt: null,
  deliveryChannel: 'email',
  telegramChatId: null,
  ...overrides,
})

/**
 * Every `skip` here is an occurrence the worker abandons *before* `runBrief`, so
 * these assertions are what stand between an undeliverable reader and a paid
 * brief nobody receives.
 */
describe('chooseDestination', () => {
  it('delivers to a verified, unsuspended address', () => {
    expect(chooseDestination(settings())).toEqual({
      kind: 'email',
      to: 'reader@example.com',
    })
  })

  it.each([
    ['an unsubscribe', { emailSuspendedAt: new Date() }],
    ['an address that has not synced yet', { email: null }],
    ['an unverified address', { emailVerified: false }],
  ])('skips the run after %s', (_case, overrides) => {
    expect(chooseDestination(settings(overrides)).kind).toBe('skip')
  })

  it('delivers to the chat id the reader stored', () => {
    expect(
      chooseDestination(
        settings({ deliveryChannel: 'telegram', telegramChatId: '-1001234' }),
      ),
    ).toEqual({ kind: 'telegram', chatId: '-1001234' })
  })

  /** There is no fallback to `TELEGRAM_CHAT_ID` — it would mail one reader's brief to another. */
  it('skips a Telegram reader who has set no chat id', () => {
    expect(
      chooseDestination(settings({ deliveryChannel: 'telegram' })).kind,
    ).toBe('skip')
  })

  /** An unsubscribe is about email; it must not silence a channel it never covered. */
  it('ignores an email suspension on the Telegram channel', () => {
    expect(
      chooseDestination(
        settings({
          deliveryChannel: 'telegram',
          telegramChatId: '-1001234',
          emailSuspendedAt: new Date(),
        }),
      ).kind,
    ).toBe('telegram')
  })

  /** The column is a plain string, so a hand-edited row must degrade, not throw. */
  it('reads an unknown channel as the default rather than failing', () => {
    expect(
      chooseDestination(settings({ deliveryChannel: 'carrier-pigeon' })),
    ).toEqual({
      kind: 'email',
      to: 'reader@example.com',
    })
  })

  it('skips a schedule whose owner no longer exists', () => {
    expect(chooseDestination(null).kind).toBe('skip')
  })
})
