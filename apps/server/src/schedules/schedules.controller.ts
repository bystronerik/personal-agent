import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
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
import {
  CreateScheduleDto,
  ScheduleDto,
  UpdateScheduleDto,
} from './schedules.dto'
import { SchedulesService } from './schedules.service'

@ApiTags('schedules')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ApiErrorDto,
  description: 'Missing or invalid access token',
})
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @ApiOperation({ operationId: 'listSchedules' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: [ScheduleDto],
    description: 'Every brief the caller has scheduled',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.schedules.list(user.userId)
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getSchedule' })
  @ZodResponse({ status: HttpStatus.OK, type: ScheduleDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Malformed id' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such schedule' })
  find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedules.find(user.userId, id)
  }

  @Post()
  @ApiOperation({ operationId: 'createSchedule' })
  @ZodResponse({ status: HttpStatus.CREATED, type: ScheduleDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Validation failed',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'The caller already has as many schedules as are allowed',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateScheduleDto,
  ) {
    return this.schedules.create(user.userId, body)
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateSchedule' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: ScheduleDto,
    description: 'The schedule as it now stands',
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Validation failed',
  })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such schedule' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.schedules.update(user.userId, id, body)
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteSchedule' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Malformed id' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such schedule' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.schedules.remove(user.userId, id)
  }
}
