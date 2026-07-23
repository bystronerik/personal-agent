import { z } from 'zod'

import { ErrorCodeSchema } from './error-codes'

/**
 * A Zod issue flattened for the wire: its `path` is a `(string | number |
 * symbol)[]`, which neither survives JSON nor describes well in OpenAPI.
 */
export const ValidationIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
    code: z.string(),
  })
  .meta({ id: 'ValidationIssue' })
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>

export const ApiErrorSchema = z
  .object({
    statusCode: z.number().int(),
    message: z.string(),
    timestamp: z.iso.datetime(),
    path: z.string(),
    errorCode: ErrorCodeSchema.optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    errors: z.array(ValidationIssueSchema).optional(),
  })
  .meta({ id: 'ApiError' })
export type ApiError = z.infer<typeof ApiErrorSchema>
