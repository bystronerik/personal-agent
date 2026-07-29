import { signUnsubscribeToken } from '@personal-agent/email/unsubscribe'
import {
  DEFAULT_DELIVERY_CHANNEL,
  DeliveryChannelSchema,
} from '@personal-agent/schemas/users'

import { type DeliveryConfig, loadDeliveryConfig } from '../../config'
import { agentDb } from '../../db'

/** The columns the decision reads, and nothing else. */
export type DeliverySettings = {
  email: string | null
  emailVerified: boolean
  emailSuspendedAt: Date | null
  deliveryChannel: string
  telegramChatId: string | null
}

export type Destination =
  | { kind: 'email'; to: string }
  | { kind: 'telegram'; chatId: string }
  | { kind: 'skip'; reason: string }

export type Recipient =
  | { kind: 'email'; to: string; unsubscribeUrl: string }
  | { kind: 'telegram'; chatId: string }
  | { kind: 'skip'; reason: string }

let config: DeliveryConfig | undefined

/**
 * Memoized, and called once at boot — a missing secret should fail while someone
 * is watching, not at 07:00 tomorrow with a paid brief already generated.
 */
export function deliveryConfig(): DeliveryConfig {
  config ??= loadDeliveryConfig()
  return config
}

/**
 * One URL, reached two ways: the link in the body is a `GET` on it and a mail
 * client's own Unsubscribe button is a `POST`. Only the `POST` commits, which is
 * what keeps a link-prefetching scanner from unsubscribing someone who never
 * clicked.
 */
const unsubscribeUrl = (userId: string): string => {
  const { publicApiUrl, unsubscribeSecret } = deliveryConfig()
  const url = new URL('/unsubscribe', publicApiUrl)
  url.searchParams.set('token', signUnsubscribeToken(userId, unsubscribeSecret))
  return url.toString()
}

/**
 * Pure, and separate from the query so the matrix below is testable without a
 * database — the `skip` arms are what stand between an undeliverable occurrence
 * and a paid brief nobody receives.
 *
 * `deliveryChannel` is a plain column, so an unreadable value degrades to the
 * default rather than dropping the brief, exactly as the API reads it back.
 */
export function chooseDestination(
  settings: DeliverySettings | null,
): Destination {
  if (!settings) {
    return { kind: 'skip', reason: 'the schedule has no owner' }
  }

  const channel = DeliveryChannelSchema.catch(DEFAULT_DELIVERY_CHANNEL).parse(
    settings.deliveryChannel,
  )

  if (channel === 'telegram') {
    return settings.telegramChatId
      ? { kind: 'telegram', chatId: settings.telegramChatId }
      : { kind: 'skip', reason: 'no Telegram chat id is set' }
  }

  if (settings.emailSuspendedAt) {
    return { kind: 'skip', reason: 'email delivery is suspended' }
  }
  if (!settings.email) {
    return { kind: 'skip', reason: 'no email address has been synced yet' }
  }
  if (!settings.emailVerified) {
    return { kind: 'skip', reason: 'the email address is not verified' }
  }

  return { kind: 'email', to: settings.email }
}

/**
 * Where this schedule's brief goes — or why it must not be generated at all.
 *
 * `run.ts` resolves this *before* `runBrief`, so an undeliverable occurrence
 * costs nothing. `lastRunAt` is left untouched on a skip, which is what lets the
 * catch-up pass deliver the next one once the reader fixes their settings.
 */
export async function resolveRecipient(userId: string): Promise<Recipient> {
  const settings = await agentDb().user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      emailSuspendedAt: true,
      deliveryChannel: true,
      telegramChatId: true,
    },
  })

  const destination = chooseDestination(settings)
  return destination.kind === 'email'
    ? { ...destination, unsubscribeUrl: unsubscribeUrl(userId) }
    : destination
}
