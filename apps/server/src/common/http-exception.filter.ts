import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import {
  type ApiError,
  ErrorCode,
  ErrorCodeSchema,
} from '@personal-agent/schemas/common'
import type { Request, Response } from 'express'
import { z } from 'zod'

const INTERNAL_MESSAGE = 'Internal server error'

/** Zod's own issues, flattened to the JSON-safe shape `ValidationIssue` describes. */
const IssuesSchema = z
  .array(
    z.object({
      code: z.string(),
      message: z.string(),
      path: z.array(z.union([z.string(), z.number(), z.symbol()])).default([]),
    }),
  )
  .transform((issues) =>
    issues.map(({ code, message, path }) => ({
      code,
      message,
      path: path.map(String).join('.'),
    })),
  )

/**
 * What `HttpException.getResponse()` may carry: Nest's own `{ message }`,
 * nestjs-zod's `{ message, errors }`, or the `{ message, errorCode, params }` a
 * service throws deliberately.
 */
const ExceptionBodySchema = z.object({
  message: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value.join('; ') : value))
    .optional(),
  errorCode: ErrorCodeSchema.optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  errors: IssuesSchema.optional(),
})

type ExceptionBody = z.infer<typeof ExceptionBodySchema>

const describe = (exception: unknown): ExceptionBody => {
  if (!(exception instanceof HttpException)) {
    return {}
  }
  const response = exception.getResponse()
  if (typeof response === 'string') {
    return { message: response }
  }
  return ExceptionBodySchema.safeParse(response).data ?? {}
}

const fallbackErrorCode = (
  status: number,
  hasIssues: boolean,
): ErrorCode | undefined => {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return ErrorCode.INTERNAL_SERVER_ERROR
  }
  if (status === HttpStatus.UNAUTHORIZED) {
    return ErrorCode.UNAUTHORIZED
  }
  return hasIssues ? ErrorCode.VALIDATION_FAILED : undefined
}

/**
 * Registered as an `APP_FILTER`, so every failure leaves the API as an
 * `ApiError` — the shape the generated client is typed against.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    const isServerFault = status >= HttpStatus.INTERNAL_SERVER_ERROR
    const { message, errorCode, params, errors } = describe(exception)
    const reason =
      message ?? (exception instanceof Error ? exception.message : undefined)

    const body: ApiError = {
      statusCode: status,
      // A 5xx reason can carry a connection string or a failed query, so it is
      // logged rather than echoed.
      message: isServerFault ? INTERNAL_MESSAGE : (reason ?? INTERNAL_MESSAGE),
      timestamp: new Date().toISOString(),
      path: request.url,
      errorCode: errorCode ?? fallbackErrorCode(status, errors !== undefined),
      params,
      errors,
    }

    const context = {
      statusCode: status,
      method: request.method,
      path: request.url,
      errorCode: body.errorCode,
      reason,
      errors,
      params,
    }
    if (isServerFault) {
      this.logger.error(
        context,
        exception instanceof Error ? exception.stack : undefined,
      )
    } else {
      this.logger.warn(context)
    }

    response.status(status).json(body)
  }
}
