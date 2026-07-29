import { Inject, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'

import type { ApiConfig } from '../config/config'
import { API_CONFIG } from '../config/config.module'

/** Only the claims this API stores. The profile carries many more. */
const ProfileSchema = z.object({
  email: z.email().nullish(),
  email_verified: z.boolean().nullish(),
})

const TokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
})

export type Auth0Profile = {
  email: string | null
  emailVerified: boolean
}

/** Re-fetch this far before expiry rather than racing the boundary. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000

/**
 * Reads a subject's email address from the Auth0 Management API — the access
 * token the portal presents carries only `sub`, so this is the only way the API
 * learns where to send a brief.
 *
 * The machine-to-machine credentials are a *different* Auth0 application from
 * the SPA, and it must be authorised for the Management API with `read:users`.
 */
@Injectable()
export class Auth0ProfileService {
  private readonly logger = new Logger(Auth0ProfileService.name)
  private readonly issuer: string
  private token?: { value: string; expiresAt: number }

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {
    this.issuer = `https://${config.auth0Domain}/`
  }

  /**
   * Null rather than a throw: a profile that cannot be read must not fail the
   * request that happened to trigger the sync. The caller retries on a later
   * process.
   */
  async fetch(userId: string): Promise<Auth0Profile | null> {
    try {
      const response = await fetch(
        `${this.issuer}api/v2/users/${encodeURIComponent(userId)}`,
        { headers: { authorization: `Bearer ${await this.accessToken()}` } },
      )
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      const profile = ProfileSchema.parse(await response.json())
      return {
        email: profile.email ?? null,
        emailVerified: profile.email_verified ?? false,
      }
    } catch (error) {
      this.logger.warn(
        `Could not read the Auth0 profile for ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  private async accessToken(): Promise<string> {
    const cached = this.token
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const response = await fetch(`${this.issuer}oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.auth0ManagementClientId,
        client_secret: this.config.auth0ManagementClientSecret,
        audience: `${this.issuer}api/v2/`,
      }),
    })
    if (!response.ok) {
      throw new Error(
        `Management API token request failed: ${response.status} ${response.statusText}`,
      )
    }

    const token = TokenSchema.parse(await response.json())
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
    }
    return token.access_token
  }
}
