import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CreateTopicDto, TopicDto } from './topics.dto'
import { TopicsService } from './topics.service'

@ApiTags('topics')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ApiErrorDto,
  description: 'Missing or invalid access token',
})
@Controller('topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  @ApiOperation({ operationId: 'listTopics' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: [TopicDto],
    description: 'Subjects to research',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.topics.list(user.userId)
  }

  @Post()
  @ApiOperation({ operationId: 'createTopic' })
  @ZodResponse({ status: HttpStatus.CREATED, type: TopicDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Validation failed',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'The subject is already on the list',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTopicDto) {
    return this.topics.create(user.userId, body.subject)
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteTopic' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Malformed id' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such topic' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.topics.remove(user.userId, id)
  }
}
