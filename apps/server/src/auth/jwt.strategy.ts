import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import type { AuthenticatedUser } from '@personal-agent/schemas/auth'
import { passportJwtSecret } from 'jwks-rsa'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { API_CONFIG } from '../config/config.module'
import type { ApiConfig } from '../config/env'

/** Only the claims this API acts on. Auth0 sends many more. */
type AccessTokenPayload = {
  sub?: string
}

const JWKS_CACHE_TTL_MS = 600_000
const JWKS_REQUESTS_PER_MINUTE = 5

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(API_CONFIG) config: ApiConfig) {
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

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Access token carries no subject')
    }
    return { userId: payload.sub }
  }
}
