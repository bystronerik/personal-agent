import { z } from 'zod'

export const StorySchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(40).max(600),
  whyItMatters: z.string().min(20).max(400),
  sourceIds: z.array(z.string().min(1)).min(1),
})

/** A brief carries this many stories, whether as research findings or headlines. */
export const STORY_COUNT = { min: 3, max: 7 } as const

export const StoriesSchema = z
  .array(StorySchema)
  .min(STORY_COUNT.min)
  .max(STORY_COUNT.max)

export type Story = z.infer<typeof StorySchema>
