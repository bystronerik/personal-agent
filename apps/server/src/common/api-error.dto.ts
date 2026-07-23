import { ApiErrorSchema } from '@personal-agent/schemas/common'
import { createZodDto } from 'nestjs-zod'

export class ApiErrorDto extends createZodDto(ApiErrorSchema) {}
