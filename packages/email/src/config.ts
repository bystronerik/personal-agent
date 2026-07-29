import { EMAIL_FROM, loadEnv, RESEND_API_KEY } from '@personal-agent/env'

const EMAIL_ENV = {
  apiKey: RESEND_API_KEY,
  from: EMAIL_FROM,
}

export const loadEmailConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(EMAIL_ENV, { source, subject: 'Email' })

export type EmailConfig = ReturnType<typeof loadEmailConfig>
