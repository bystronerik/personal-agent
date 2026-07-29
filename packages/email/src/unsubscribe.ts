import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * `<base64url(userId)>.<hmac>`, verified with the shared `UNSUBSCRIBE_SECRET`.
 *
 * Stateless and without expiry, so the link in a brief delivered months ago
 * still works — which is what an unsubscribe link has to be. Rotating the secret
 * is therefore the only revocation, and it revokes every link at once.
 *
 * `apps/agent` signs and `apps/server` verifies, in different processes. That is
 * why this lives here and is reached through the `./unsubscribe` subpath rather
 * than the root: `apps/server` needs the encoding but sends no mail, and the
 * root barrel would pull the Resend SDK into its bundle.
 */

const tag = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url')

export const signUnsubscribeToken = (
  userId: string,
  secret: string,
): string => {
  const payload = Buffer.from(userId, 'utf8').toString('base64url')
  return `${payload}.${tag(payload, secret)}`
}

/**
 * Null for anything that does not verify. `timingSafeEqual` needs equal lengths,
 * so a wrong-length signature is rejected before the comparison rather than by
 * it.
 */
export const verifyUnsubscribeToken = (
  token: string,
  secret: string,
): string | null => {
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) {
    return null
  }

  const expected = Buffer.from(tag(payload, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }

  const userId = Buffer.from(payload, 'base64url').toString('utf8')
  return userId.length > 0 ? userId : null
}
