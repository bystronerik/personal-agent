import { createZodDto } from 'nestjs-zod'

import {
  CreateScheduleSchema,
  ScheduleSchema,
  UpdateScheduleSchema,
} from '@personal-agent/schemas/schedules'

export class ScheduleDto extends createZodDto(ScheduleSchema) {}
export class CreateScheduleDto extends createZodDto(CreateScheduleSchema) {}
export class UpdateScheduleDto extends createZodDto(UpdateScheduleSchema) {}
