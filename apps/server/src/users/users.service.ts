import { BadRequestException, Injectable } from '@nestjs/common'

import type { User } from '@personal-agent/db'
import { ErrorCode } from '@personal-agent/schemas/common'
import {
  DEFAULT_DELIVERY_CHANNEL,
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  DeliveryChannelSchema,
  EmailSuspensionReasonSchema,
  LocaleSchema,
  ThemeSchema,
  type UpdateUserPreferences,
  type UserPreferences,
} from '@personal-agent/schemas/users'

import { PrismaService } from '../prisma/prisma.service'
import { Auth0ProfileService } from './auth0-profile.service'

/**
 * Every enum here is a plain column, so dropping a value from one leaves rows
 * holding what the contract no longer admits. They read as the default rather
 * than failing the request; a reason has no sensible default, so an unreadable
 * one reads as the only reason that exists today.
 */
const toPreferences = (row: User): UserPreferences => ({
  locale: LocaleSchema.catch(DEFAULT_LOCALE).parse(row.locale),
  theme: ThemeSchema.catch(DEFAULT_THEME).parse(row.theme),
  deliveryChannel: DeliveryChannelSchema.catch(DEFAULT_DELIVERY_CHANNEL).parse(
    row.deliveryChannel,
  ),
  telegramChatId: row.telegramChatId,
  email: row.email,
  emailVerified: row.emailVerified,
  emailSuspendedAt: row.emailSuspendedAt?.toISOString() ?? null,
  emailSuspendedReason: row.emailSuspendedAt
    ? EmailSuspensionReasonSchema.catch('unsubscribed').parse(
        row.emailSuspendedReason,
      )
    : null,
})

/**
 * The rule a patch schema cannot express: a patch setting only
 * `deliveryChannel` is valid on its own, and only the merged row says whether
 * the chosen channel has anywhere to deliver to.
 */
const assertDeliverable = (merged: {
  deliveryChannel: string
  telegramChatId: string | null
}): void => {
  if (merged.deliveryChannel === 'telegram' && !merged.telegramChatId) {
    throw new BadRequestException({
      message: 'Telegram delivery needs a chat id',
      errorCode: ErrorCode.DELIVERY_TELEGRAM_CHAT_ID_REQUIRED,
    })
  }
}

/**
 * A `sub` seen once is not queried again, so a row deleted out of band stays
 * uncreated until this process restarts.
 */
@Injectable()
export class UsersService {
  private readonly ensured = new Set<string>()
  /**
   * Separate from `ensured`, and recorded on failure too: without it a subject
   * Auth0 holds no address for would mean a Management API call on *every*
   * request. The cost is that a transient failure is retried no sooner than the
   * next process start.
   */
  private readonly syncAttempted = new Set<string>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth0: Auth0ProfileService,
  ) {}

  async ensure(userId: string): Promise<void> {
    if (this.ensured.has(userId)) {
      return
    }
    const row = await this.prisma.client.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    })
    this.ensured.add(userId)

    if (row.email === null) {
      await this.syncEmail(userId)
    }
  }

  async preferences(userId: string): Promise<UserPreferences> {
    const row = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    })
    return toPreferences(row)
  }

  async updatePreferences(
    userId: string,
    patch: UpdateUserPreferences,
  ): Promise<UserPreferences> {
    const current = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    })
    assertDeliverable({ ...current, ...patch })

    const row = await this.prisma.client.user.update({
      where: { id: userId },
      data: patch,
    })
    return toPreferences(row)
  }

  /**
   * Deliberately not reachable through `updatePreferences`: an unsubscribe is
   * the reader's own decision, so undoing it is an act of its own rather than a
   * side effect of changing some other setting.
   */
  async resumeEmail(userId: string): Promise<UserPreferences> {
    const row = await this.prisma.client.user.update({
      where: { id: userId },
      data: { emailSuspendedAt: null, emailSuspendedReason: null },
    })
    return toPreferences(row)
  }

  /** Idempotent: unsubscribing twice must not move the recorded moment. */
  async suspendEmail(userId: string, reason: string): Promise<void> {
    await this.prisma.client.user.updateMany({
      where: { id: userId, emailSuspendedAt: null },
      data: { emailSuspendedAt: new Date(), emailSuspendedReason: reason },
    })
  }

  private async syncEmail(userId: string): Promise<void> {
    if (this.syncAttempted.has(userId)) {
      return
    }
    this.syncAttempted.add(userId)

    const profile = await this.auth0.fetch(userId)
    if (!profile?.email) {
      return
    }
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { email: profile.email, emailVerified: profile.emailVerified },
    })
  }
}
