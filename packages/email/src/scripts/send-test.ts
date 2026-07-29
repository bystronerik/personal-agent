import { sendBriefEmail } from '../client'
import { loadEmailConfig } from '../config'

const TEST_TEXT = [
  'Personal Agent is connected. This is a test message.',
  'Unsubscribe: https://example.com/unsubscribe?token=test',
].join('\n\n')

const recipient = (): string => {
  const to = process.argv[process.argv.indexOf('--to') + 1]
  if (!to || to.startsWith('--')) {
    throw new Error('Usage: pnpm email:send-test --to you@example.com')
  }
  return to
}

/**
 * Misconfiguration is the common failure here, and a stack trace buries the one
 * line that says which variable is missing.
 */
try {
  const config = loadEmailConfig()
  const to = recipient()

  console.log(`Sending a test message from ${config.from} to ${to}…`)
  const id = await sendBriefEmail(config, {
    to,
    subject: 'Personal Agent test',
    text: TEST_TEXT,
    oneClickUnsubscribeUrl: 'https://example.com/unsubscribe',
  })
  console.log(`Delivered: ${id}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
