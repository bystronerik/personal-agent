import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

/**
 * A `sub` seen once is not queried again, so a row deleted out of band stays
 * uncreated until this process restarts.
 */
@Injectable()
export class UsersService {
  private readonly ensured = new Set<string>()

  constructor(private readonly prisma: PrismaService) {}

  async ensure(userId: string): Promise<void> {
    if (this.ensured.has(userId)) {
      return
    }
    await this.prisma.client.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    })
    this.ensured.add(userId)
  }
}
