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
  subject: row.subject,
  createdAt: row.createdAt.toISOString(),
})

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Topic[]> {
    const rows = await this.prisma.client.topic.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toTopic)
  }

  async create(userId: string, subject: string): Promise<Topic> {
    try {
      const row = await this.prisma.client.topic.create({
        data: { userId, subject },
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
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.client.topic.deleteMany({
      where: { id, userId },
    })
    if (count === 0) {
      throw new NotFoundException({
        message: `No topic with id ${id}`,
        errorCode: ErrorCode.TOPIC_NOT_FOUND,
        params: { id },
      })
    }
  }
}
