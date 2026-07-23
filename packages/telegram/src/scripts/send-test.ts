import { sendMessage } from '../client'
import { loadTelegramConfig } from '../config'
import { MESSAGE_LIMIT } from '../split'
import { runScript } from './run-script'

const TEST_MESSAGE = 'Personal Agent is connected. This is a test message.'

/** Enough paragraphs to cross `MESSAGE_LIMIT` and exercise the splitter. */
const longTestMessage = (): string => {
  const paragraph = (index: number) =>
    `Paragraph ${index}. ${'Delivery check. '.repeat(20)}`

  const paragraphs: string[] = []
  let length = 0
  for (let index = 1; length <= MESSAGE_LIMIT * 2; index += 1) {
    const next = paragraph(index)
    paragraphs.push(next)
    length += next.length + 2
  }
  return paragraphs.join('\n\n')
}

await runScript(async () => {
  const config = loadTelegramConfig()
  const long = process.argv.includes('--long')

  console.log(`Sending a test message to chat ${config.chatId}…`)

  const sent = await sendMessage(
    config,
    long ? longTestMessage() : TEST_MESSAGE,
  )

  const ids = sent.map((message) => message.message_id).join(', ')
  console.log(
    `Delivered ${sent.length} message${sent.length === 1 ? '' : 's'} ` +
      `to ${sent[0]?.chat.id}: ${ids}`,
  )
})
