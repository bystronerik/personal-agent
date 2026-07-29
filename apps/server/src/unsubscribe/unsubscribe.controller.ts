import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'

import { verifyUnsubscribeToken } from '@personal-agent/email/unsubscribe'

import { Public } from '../auth/public.decorator'
import type { ApiConfig } from '../config/config'
import { API_CONFIG } from '../config/config.module'
import { UsersService } from '../users/users.service'

const SUSPENSION_REASON = 'unsubscribed'

/**
 * The two halves of an unsubscribe, reached with no session at all.
 *
 * Excluded from the OpenAPI document on purpose: these are not portal API calls,
 * and generated hooks would attach an access token that by definition is not
 * there. The portal reaches the `POST` with a plain `fetch`.
 */
@ApiExcludeController()
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly users: UsersService,
  ) {}

  /**
   * **Verifies and changes nothing.** Corporate mail scanners prefetch the links
   * in a message body, so a `GET` that suspended delivery would unsubscribe
   * readers who never clicked. The portal it redirects to is what asks; the
   * `POST` below is what commits.
   */
  @Public()
  @Get()
  redirect(@Query('token') token: string | undefined, @Res() res: Response) {
    const target = new URL('/unsubscribe', this.config.corsOrigin)
    if (token && verifyUnsubscribeToken(token, this.config.unsubscribeSecret)) {
      target.searchParams.set('token', token)
    } else {
      target.searchParams.set('error', 'invalid')
    }
    res.redirect(HttpStatus.FOUND, target.toString())
  }

  /**
   * Both the RFC 8058 one-click button — which a mail client sends only on a
   * real user action — and the portal's confirmation land here. The token stays
   * in the query because a one-click `POST` carries a fixed body of its own and
   * no room for ours.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Query('token') token: string | undefined) {
    const userId = token
      ? verifyUnsubscribeToken(token, this.config.unsubscribeSecret)
      : null
    if (!userId) {
      throw new BadRequestException('That unsubscribe link is not valid')
    }
    await this.users.suspendEmail(userId, SUSPENSION_REASON)
    return { status: SUSPENSION_REASON }
  }
}
