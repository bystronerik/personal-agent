import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { ZodResponse } from 'nestjs-zod'

import type { AuthenticatedUser } from '@personal-agent/schemas/auth'

import { CurrentUser } from '../auth/current-user.decorator'
import { ApiErrorDto } from '../common/api-error.dto'
// Value imports: `emitDecoratorMetadata` records the DTO class at runtime, and
// a type-only import would leave the validation pipe nothing to parse with.
import { UpdateUserPreferencesDto, UserPreferencesDto } from './users.dto'
import { UsersService } from './users.service'

@ApiTags('preferences')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ApiErrorDto,
  description: 'Missing or invalid access token',
})
@Controller('me/preferences')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ operationId: 'getMyPreferences' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: UserPreferencesDto,
    description: 'How the portal is set up for the caller',
  })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.users.preferences(user.userId)
  }

  @Patch()
  @ApiOperation({ operationId: 'updateMyPreferences' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: UserPreferencesDto,
    description: 'The preferences as they now stand',
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Validation failed',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateUserPreferencesDto,
  ) {
    return this.users.updatePreferences(user.userId, body)
  }

  @Post('resume-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'resumeEmailDelivery' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: UserPreferencesDto,
    description: 'The preferences, with email delivery no longer suspended',
  })
  resumeEmail(@CurrentUser() user: AuthenticatedUser) {
    return this.users.resumeEmail(user.userId)
  }
}
