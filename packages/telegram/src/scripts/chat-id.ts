import type { Chat } from 'grammy/types'

import { getUpdates } from '../client'
import { loadBotConnection } from '../config'
import { runScript } from './run-script'

/** `Chat` is a union: only private chats carry a name, only the rest a title. */
const name = (chat: Chat): string =>
  chat.type === 'private' ? (chat.username ?? chat.first_name) : chat.title

const describe = (chat: Chat): string =>
  [chat.id, chat.type, name(chat)].join('  ')

await runScript(async () => {
  const updates = await getUpdates(loadBotConnection())

  const chats = new Map<number, Chat>()
  for (const update of updates) {
    const chat = (update.message ?? update.channel_post)?.chat
    if (chat) {
      chats.set(chat.id, chat)
    }
  }

  if (chats.size === 0) {
    console.log(
      'No chats found. Send any message to your bot, then run this again.\n' +
        'For a group, add the bot as a member first; for a channel, make it an admin.',
    )
    return
  }

  console.log('Set TELEGRAM_CHAT_ID in .env to one of:\n')
  for (const chat of chats.values()) {
    console.log(`  ${describe(chat)}`)
  }
})
