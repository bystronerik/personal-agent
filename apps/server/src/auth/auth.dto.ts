import { AuthenticatedUserSchema } from '@personal-agent/schemas/auth'
import { createZodDto } from 'nestjs-zod'

export class AuthenticatedUserDto extends createZodDto(
  AuthenticatedUserSchema,
) {}
