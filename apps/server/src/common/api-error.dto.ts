import { createZodDto } from 'nestjs-zod'

import { ApiErrorSchema } from '@personal-agent/schemas/common'

export class ApiErrorDto extends createZodDto(ApiErrorSchema) {}
