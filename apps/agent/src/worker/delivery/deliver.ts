import {
  loadTelegramConfig,
  PartialSendError,
  sendMessage,
  type TelegramConfig,
} from '@personal-agent/telegram'

import type { Brief } from '../../schema'
import { formatBrief } from './format'

let config: TelegramConfig | undefined

/**
 * Memoized, and called once at boot — a missing token should fail while someone
 * is watching, not at 07:00 tomorrow with a paid brief already generated.
 */
export function telegramConfig(): TelegramConfig {
  config ??= loadTelegramConfig()
  return config
}

/** Returns the number of messages sent: a brief can exceed Telegram's 4096. */
export async function deliverBrief(
  brief: Brief,
  timeZone: string,
): Promise<number> {
  const sent = await sendMessage(telegramConfig(), formatBrief(brief, timeZone))
  return sent.length
}

/**
 * How much of a failed delivery already reached the chat — the one thing the run
 * needs from a Telegram error, so nothing above this file imports grammY's.
 */
export const deliveredBefore = (error: unknown): number =>
  error instanceof PartialSendError ? error.sent : 0
