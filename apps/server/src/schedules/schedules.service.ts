import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cron, CronPattern } from 'croner'

import {
  Prisma,
  type Schedule as ScheduleRow,
  type Topic as TopicRow,
} from '@personal-agent/db'
import { ErrorCode } from '@personal-agent/schemas/common'
import {
  type CreateSchedule,
  EditionSchema,
  MAX_SCHEDULES_PER_USER,
  type Schedule,
  type UpdateSchedule,
} from '@personal-agent/schemas/schedules'

import { PrismaService } from '../prisma/prisma.service'
import { toTopic } from '../topics/topic.mapper'

const RECORD_NOT_FOUND = 'P2025'

/**
 * `edition` is a plain column, so a row written outside this API can hold a value
 * the contract no longer admits. It reads as the default rather than failing the
 * response.
 */
const FALLBACK_EDITION = 'morning'

const withTopics = {
  topics: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ScheduleInclude

type ScheduleWithTopics = ScheduleRow & { topics: TopicRow[] }

/** A `Cron` built with no handler computes the next occurrence and arms nothing. */
const nextRunAt = (row: ScheduleRow): string | null => {
  if (!row.enabled) return null
  try {
    const next = new Cron(row.cron, { timezone: row.timezone }).nextRun()
    return next?.toISOString() ?? null
  } catch {
    return null
  }
}

const toSchedule = (row: ScheduleWithTopics): Schedule => ({
  id: row.id,
  edition: EditionSchema.catch(FALLBACK_EDITION).parse(row.edition),
  cron: row.cron,
  timezone: row.timezone,
  enabled: row.enabled,
  lastRunAt: row.lastRunAt?.toISOString() ?? null,
  nextRunAt: nextRunAt(row),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  topics: row.topics.map(toTopic),
})

const scheduleNotFound = (id: string): NotFoundException =>
  new NotFoundException({
    message: `No schedule with id ${id}`,
    errorCode: ErrorCode.SCHEDULE_NOT_FOUND,
    params: { id },
  })

/**
 * The written pattern has passed `CronExpressionSchema`, which accepts a subset
 * of what croner parses. This is the library itself having the last word, so a
 * pattern the worker cannot fire can never be stored — whatever the subset drifts
 * into accepting.
 */
const assertFirable = (cron: string | undefined): void => {
  if (cron === undefined) return
  try {
    new CronPattern(cron)
  } catch {
    throw new BadRequestException({
      message: `"${cron}" is not a pattern the worker can fire`,
      errorCode: ErrorCode.SCHEDULE_CRON_UNSUPPORTED,
      params: { cron },
    })
  }
}

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Schedule[]> {
    const rows = await this.prisma.client.schedule.findMany({
      where: { userId },
      include: withTopics,
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(toSchedule)
  }

  async find(userId: string, id: string): Promise<Schedule> {
    const row = await this.prisma.client.schedule.findFirst({
      where: { id, userId },
      include: withTopics,
    })
    if (!row) {
      throw scheduleNotFound(id)
    }
    return toSchedule(row)
  }

  /**
   * The cap is counted inside the transaction, which two simultaneous creates can
   * still cross under Postgres' default isolation. It is a guardrail on cost, not
   * a boundary.
   */
  async create(userId: string, input: CreateSchedule): Promise<Schedule> {
    assertFirable(input.cron)
    const subjects = [...new Set(input.topics ?? [])]

    const row = await this.prisma.client.$transaction(async (tx) => {
      const owned = await tx.schedule.count({ where: { userId } })
      if (owned >= MAX_SCHEDULES_PER_USER) {
        throw new ConflictException({
          message: `A user may have at most ${MAX_SCHEDULES_PER_USER} schedules`,
          errorCode: ErrorCode.SCHEDULE_LIMIT_REACHED,
          params: { limit: MAX_SCHEDULES_PER_USER },
        })
      }

      return tx.schedule.create({
        data: {
          userId,
          cron: input.cron,
          timezone: input.timezone,
          edition: input.edition,
          enabled: input.enabled,
          topics: { create: subjects.map((subject) => ({ subject })) },
        },
        include: withTopics,
      })
    })

    return toSchedule(row)
  }

  /** Scoped by owner, so an id guessed by another caller reads as missing. */
  async update(
    userId: string,
    id: string,
    patch: UpdateSchedule,
  ): Promise<Schedule> {
    assertFirable(patch.cron)

    try {
      const row = await this.prisma.client.schedule.update({
        where: { id_userId: { id, userId } },
        data: patch,
        include: withTopics,
      })
      return toSchedule(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        throw scheduleNotFound(id)
      }
      throw error
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.client.schedule.deleteMany({
      where: { id, userId },
    })
    if (count === 0) {
      throw scheduleNotFound(id)
    }
  }
}
