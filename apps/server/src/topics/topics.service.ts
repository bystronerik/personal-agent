import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { Prisma, type Topic as TopicRow } from '@personal-agent/db'
import { ErrorCode } from '@personal-agent/schemas/common'
import type { Topic } from '@personal-agent/schemas/topics'

import { PrismaService } from '../prisma/prisma.service'

const UNIQUE_VIOLATION = 'P2002'

const toTopic = (row: TopicRow): Topic => ({
  id: row.id,
  scheduleId: row.scheduleId,
  subject: row.subject,
  createdAt: row.createdAt.toISOString(),
})

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, scheduleId: string): Promise<Topic[]> {
    const rows = await this.prisma.client.topic.findMany({
      where: { scheduleId, userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toTopic)
  }

  async create(
    userId: string,
    scheduleId: string,
    subject: string,
  ): Promise<Topic> {
    await this.assertOwnsSchedule(userId, scheduleId)

    try {
      const row = await this.prisma.client.topic.create({
        data: { scheduleId, userId, subject },
      })
      return toTopic(row)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException({
          message: `"${subject}" is already on the list`,
          errorCode: ErrorCode.TOPIC_ALREADY_EXISTS,
          params: { subject },
        })
      }
      throw error
    }
  }

  /** Scoped by owner, so an id guessed by another caller reads as missing. */
  async remove(userId: string, scheduleId: string, id: string): Promise<void> {
    const { count } = await this.prisma.client.topic.deleteMany({
      where: { id, scheduleId, userId },
    })
    if (count === 0) {
      throw new NotFoundException({
        message: `No topic with id ${id}`,
        errorCode: ErrorCode.TOPIC_NOT_FOUND,
        params: { id },
      })
    }
  }

  /**
   * The composite `(schedule_id, user_id)` key would reject a schedule the
   * caller does not own, but as a foreign-key error — a 500 where the caller
   * should see "no such schedule".
   */
  private async assertOwnsSchedule(
    userId: string,
    scheduleId: string,
  ): Promise<void> {
    const schedule = await this.prisma.client.schedule.findFirst({
      where: { id: scheduleId, userId },
      select: { id: true },
    })
    if (!schedule) {
      throw new NotFoundException({
        message: `No schedule with id ${scheduleId}`,
        errorCode: ErrorCode.SCHEDULE_NOT_FOUND,
        params: { id: scheduleId },
      })
    }
  }
}
