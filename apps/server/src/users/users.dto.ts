import { createZodDto } from 'nestjs-zod'

import {
  UpdateUserPreferencesSchema,
  UserPreferencesSchema,
} from '@personal-agent/schemas/users'

export class UserPreferencesDto extends createZodDto(UserPreferencesSchema) {}
export class UpdateUserPreferencesDto extends createZodDto(
  UpdateUserPreferencesSchema,
) {}
