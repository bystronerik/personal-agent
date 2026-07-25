import { createZodDto } from 'nestjs-zod'

import { CreateTopicSchema, TopicSchema } from '@personal-agent/schemas/topics'

export class TopicDto extends createZodDto(TopicSchema) {}
export class CreateTopicDto extends createZodDto(CreateTopicSchema) {}
