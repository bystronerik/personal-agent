import { z } from 'zod'

export const AuthenticatedUserSchema = z
  .object({
    userId: z.string(),
  })
  .meta({ id: 'AuthenticatedUser' })
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>
