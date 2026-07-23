import { ApiErrorSchema, type ErrorCode } from '@personal-agent/schemas/common'

import { accessToken } from '../auth/token'
import { env } from '../env'

const NO_CONTENT = 204

export class ApiError extends Error {
  readonly status: number
  readonly errorCode?: ErrorCode
  readonly params?: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    errorCode?: ErrorCode,
    params?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
    this.params = params
  }
}

/**
 * Mutator for the generated client: prefixes the API origin and attaches the
 * Auth0 access token. The `{ data, status, headers }` envelope is orval's
 * contract for its fetch client, not a choice — the generated response types
 * are written to match it.
 */
export const apiFetch = async <T>(
  path: string,
  options: RequestInit,
): Promise<T> => {
  const token = await accessToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(new URL(path, env.apiUrl), {
    ...options,
    headers,
  })

  const data =
    response.status === NO_CONTENT ||
    response.headers.get('content-length') === '0'
      ? undefined
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    // Anything the API itself rejected carries `ApiError`. A failure from in
    // front of it — a proxy, a gateway — does not, and falls back to the status.
    const problem = ApiErrorSchema.safeParse(data).data
    throw new ApiError(
      response.status,
      problem?.message ?? response.statusText,
      problem?.errorCode,
      problem?.params,
    )
  }

  return { data, status: response.status, headers: response.headers } as T
}
