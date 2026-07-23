type TokenGetter = () => Promise<string>

let getToken: TokenGetter | null = null

/**
 * The generated API client's mutator is a plain function, so it cannot call
 * `useAuth0()` for a token. `AuthTokenBridge` hands it in from inside the
 * provider instead; this module-level slot is the seam between the two.
 */
export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter
}

export async function accessToken(): Promise<string | null> {
  return getToken ? await getToken() : null
}
