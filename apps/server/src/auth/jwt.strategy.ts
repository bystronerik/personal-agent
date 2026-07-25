import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { passportJwtSecret } from 'jwks-rsa'
import { ExtractJwt, Strategy } from 'passport-jwt'

import type { AuthenticatedUser } from '@personal-agent/schemas/auth'

import type { ApiConfig } from '../config/config'
import { API_CONFIG } from '../config/config.module'
import { UsersService } from '../users/users.service'

/** Only the claims this API acts on. Auth0 sends many more. */
type AccessTokenPayload = {
  sub?: string
}

const JWKS_CACHE_TTL_MS = 600_000
const JWKS_REQUESTS_PER_MINUTE = 5

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(API_CONFIG) config: ApiConfig,
    private readonly users: UsersService,
  ) {
    const issuer = `https://${config.auth0Domain}/`
    super({
      // Auth0 signs with a rotating key pair, so the public key is fetched from
      // the tenant's JWKS rather than configured. Caching and rate limiting are
      // on because this runs on every request.
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${issuer}.well-known/jwks.json`,
        cache: true,
        cacheMaxAge: JWKS_CACHE_TTL_MS,
        rateLimit: true,
        jwksRequestsPerMinute: JWKS_REQUESTS_PER_MINUTE,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.auth0Audience,
      issuer,
      algorithms: ['RS256'],
    })
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Access token carries no subject')
    }
    await this.users.ensure(payload.sub)
    return { userId: payload.sub }
  }
}
