import {
  type EmailConfig,
  loadEmailConfig,
  sendBriefEmail,
} from '@personal-agent/email'
import {
  type BotConnection,
  loadBotConnection,
  PartialSendError,
  sendMessage,
} from '@personal-agent/telegram'

import type { Brief } from '../../schema'
import { formatBrief, formatSubject } from './format'
import type { Recipient } from './recipient'

let email: EmailConfig | undefined
let telegram: BotConnection | undefined

const emailConfig = (): EmailConfig => {
  email ??= loadEmailConfig()
  return email
}

const telegramConnection = (): BotConnection => {
  telegram ??= loadBotConnection()
  return telegram
}

/**
 * Called once at boot — a missing key should fail while someone is watching, not
 * at 07:00 tomorrow with a paid brief already generated. **Both** channels are
 * loaded regardless of any one reader's setting: the worker serves every
 * schedule in the table, and either channel can be chosen while it is running.
 */
export function loadDeliveryClients(): void {
  emailConfig()
  telegramConnection()
}

/**
 * Returns how many messages reached the reader: a brief can exceed Telegram's
 * 4096 characters, while email is always one.
 */
export async function deliverBrief(
  brief: Brief,
  timeZone: string,
  recipient: Exclude<Recipient, { kind: 'skip' }>,
): Promise<number> {
  const text = formatBrief(brief, timeZone)

  if (recipient.kind === 'telegram') {
    const sent = await sendMessage(telegramConnection(), recipient.chatId, text)
    return sent.length
  }

  await sendBriefEmail(emailConfig(), {
    to: recipient.to,
    subject: formatSubject(brief, timeZone),
    text: `${text}\n\nUnsubscribe: ${recipient.unsubscribeUrl}`,
    oneClickUnsubscribeUrl: recipient.unsubscribeUrl,
  })
  return 1
}

/**
 * How much of a failed delivery already reached the reader — the one thing a run
 * needs from a transport error, so nothing above this file imports grammY's.
 * Email has no such state: one call sends the whole brief or none of it, so a
 * failed email is always safely retryable.
 */
export const deliveredBefore = (error: unknown): number =>
  error instanceof PartialSendError ? error.sent : 0
