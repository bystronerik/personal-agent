import { z } from 'zod'

/**
 * `db` is a closed set rather than a probe message: the route is public, and a
 * driver error names the host, port, database and user.
 */
export const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    db: z.enum(['ok', 'unreachable']),
  })
  .meta({ id: 'Health' })
export type Health = z.infer<typeof HealthSchema>
