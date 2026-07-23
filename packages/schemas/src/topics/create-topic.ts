import { z } from 'zod'

const SUBJECT_MIN_LENGTH = 2
const SUBJECT_MAX_LENGTH = 120

export const CreateTopicSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(SUBJECT_MIN_LENGTH, 'is too short to research')
      .max(SUBJECT_MAX_LENGTH, 'is a paragraph, not a subject'),
  })
  .meta({ id: 'CreateTopic' })
export type CreateTopic = z.infer<typeof CreateTopicSchema>
