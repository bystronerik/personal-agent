import { Resend } from 'resend'

import type { EmailConfig } from './config'

export type BriefEmail = {
  readonly to: string
  readonly subject: string
  /** Plain text, as `apps/agent` already renders a brief for Telegram. */
  readonly text: string
  /**
   * Where a mail client's own Unsubscribe button POSTs (RFC 8058). The link a
   * reader clicks in the body is the caller's to compose into `text` — it is a
   * `GET` on the same token, and only that asymmetry keeps a link-prefetching
   * scanner from unsubscribing someone who never clicked.
   */
  readonly oneClickUnsubscribeUrl: string
}

/**
 * The SDK reports a rejected send in `error` rather than throwing, so a caller
 * that only awaits would record a delivery that never happened.
 */
export async function sendBriefEmail(
  config: EmailConfig,
  email: BriefEmail,
): Promise<string> {
  const { data, error } = await new Resend(config.apiKey).emails.send({
    from: config.from,
    to: email.to,
    subject: email.subject,
    text: email.text,
    headers: {
      'List-Unsubscribe': `<${email.oneClickUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (error) {
    throw new Error(`Resend rejected the send: ${error.message}`)
  }
  if (!data) {
    throw new Error('Resend accepted the send but returned no message id')
  }
  return data.id
}
