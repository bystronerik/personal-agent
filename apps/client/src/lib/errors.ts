import { ApiError } from './api-fetcher'

export const describe = (error: unknown): string =>
  error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
