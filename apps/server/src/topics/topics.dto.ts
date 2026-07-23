import { CreateTopicSchema, TopicSchema } from '@personal-agent/schemas/topics'
import { createZodDto } from 'nestjs-zod'

export class TopicDto extends createZodDto(TopicSchema) {}
export class CreateTopicDto extends createZodDto(CreateTopicSchema) {}
