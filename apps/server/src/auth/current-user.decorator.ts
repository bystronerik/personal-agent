import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '@personal-agent/schemas/auth'

/** The Auth0 subject of the caller, as put on the request by `JwtStrategy`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>()
    return request.user
  },
)
