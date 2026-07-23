import { z } from 'zod'

export const ErrorCode = {
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
  TOPIC_ALREADY_EXISTS: 'TOPIC_ALREADY_EXISTS',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const

export const ErrorCodeSchema = z.enum(ErrorCode).meta({ id: 'ErrorCode' })
export type ErrorCode = z.infer<typeof ErrorCodeSchema>
