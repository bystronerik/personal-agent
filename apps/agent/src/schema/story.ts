import { z } from 'zod'

export const StorySchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(40).max(600),
  whyItMatters: z.string().min(20).max(400),
  sourceIds: z.array(z.string().min(1)).min(1),
})

/** A brief carries 3 to 7 stories, whether as research findings or headlines. */
export const StoriesSchema = z.array(StorySchema).min(3).max(7)

export type Story = z.infer<typeof StorySchema>
