import { HealthSchema } from '@personal-agent/schemas/health'
import { createZodDto } from 'nestjs-zod'

export class HealthDto extends createZodDto(HealthSchema) {}
