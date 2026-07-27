import type { Topic as TopicRow } from '@personal-agent/db'
import type { Topic } from '@personal-agent/schemas/topics'

export const toTopic = (row: TopicRow): Topic => ({
  id: row.id,
  scheduleId: row.scheduleId,
  subject: row.subject,
  createdAt: row.createdAt.toISOString(),
})
