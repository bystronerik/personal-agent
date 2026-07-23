import { Controller, Get, HttpStatus } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { AuthenticatedUser } from '@personal-agent/schemas/auth'
import { ZodResponse } from 'nestjs-zod'

import { ApiErrorDto } from '../common/api-error.dto'
// Value import: `emitDecoratorMetadata` records the DTO class at runtime, and a
// type-only import would leave the serializer nothing to parse with.
import { AuthenticatedUserDto } from './auth.dto'
import { CurrentUser } from './current-user.decorator'

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ApiErrorDto,
  description: 'Missing or invalid access token',
})
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ operationId: 'getMe' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: AuthenticatedUserDto,
    description: 'The caller the access token identifies',
  })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }
}
