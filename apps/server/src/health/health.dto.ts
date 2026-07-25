import { createZodDto } from 'nestjs-zod'

import { HealthSchema } from '@personal-agent/schemas/health'

export class HealthDto extends createZodDto(HealthSchema) {}
