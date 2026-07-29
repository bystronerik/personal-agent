import { describe, expect, it } from 'vitest'

import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe'

const SECRET = 'a'.repeat(64)
const OTHER_SECRET = 'b'.repeat(64)
const USER_ID = 'auth0|68a0f2c1e4b09d3f7a1c2e55'

describe('the unsubscribe token', () => {
  it('round-trips a subject through sign and verify', () => {
    const token = signUnsubscribeToken(USER_ID, SECRET)

    expect(verifyUnsubscribeToken(token, SECRET)).toBe(USER_ID)
  })

  /** An Auth0 `sub` carries a `|`, which must survive a URL query parameter. */
  it('produces a token that needs no escaping in a URL', () => {
    const token = signUnsubscribeToken(USER_ID, SECRET)

    expect(encodeURIComponent(token)).toBe(token)
  })

  it('rejects a token signed with a different secret', () => {
    const token = signUnsubscribeToken(USER_ID, OTHER_SECRET)

    expect(verifyUnsubscribeToken(token, SECRET)).toBeNull()
  })

  /**
   * The whole point of the signature: a reader must not be able to unsubscribe
   * anyone but themselves by editing the id in their own link.
   */
  it('rejects a payload swapped for another subject', () => {
    const [, signature] = signUnsubscribeToken(USER_ID, SECRET).split('.')
    const victim = Buffer.from('auth0|someone-else').toString('base64url')

    expect(verifyUnsubscribeToken(`${victim}.${signature}`, SECRET)).toBeNull()
  })

  it.each([
    ['no separator', 'notatoken'],
    ['an empty signature', 'cGF5bG9hZA.'],
    ['an empty payload', '.c2lnbmF0dXJl'],
    ['a third segment', `${signUnsubscribeToken(USER_ID, SECRET)}.extra`],
    [
      'a truncated signature',
      signUnsubscribeToken(USER_ID, SECRET).slice(0, -4),
    ],
  ])('rejects %s', (_case, token) => {
    expect(verifyUnsubscribeToken(token, SECRET)).toBeNull()
  })
})
