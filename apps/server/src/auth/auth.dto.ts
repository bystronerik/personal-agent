import { createZodDto } from 'nestjs-zod'

import { AuthenticatedUserSchema } from '@personal-agent/schemas/auth'

export class AuthenticatedUserDto extends createZodDto(
  AuthenticatedUserSchema,
) {}
