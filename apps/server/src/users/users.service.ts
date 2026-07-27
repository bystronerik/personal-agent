import { Injectable } from '@nestjs/common'

import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  LocaleSchema,
  ThemeSchema,
  type UpdateUserPreferences,
  type UserPreferences,
} from '@personal-agent/schemas/users'

import { PrismaService } from '../prisma/prisma.service'

/**
 * Both are plain columns, so dropping a value from either enum leaves rows
 * holding one the contract no longer admits. They read as the default rather
 * than failing the request.
 */
const toPreferences = (row: {
  locale: string
  theme: string
}): UserPreferences => ({
  locale: LocaleSchema.catch(DEFAULT_LOCALE).parse(row.locale),
  theme: ThemeSchema.catch(DEFAULT_THEME).parse(row.theme),
})

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

  async preferences(userId: string): Promise<UserPreferences> {
    const row = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true, theme: true },
    })
    return toPreferences(row)
  }

  async updatePreferences(
    userId: string,
    patch: UpdateUserPreferences,
  ): Promise<UserPreferences> {
    const row = await this.prisma.client.user.update({
      where: { id: userId },
      data: patch,
      select: { locale: true, theme: true },
    })
    return toPreferences(row)
  }
}
