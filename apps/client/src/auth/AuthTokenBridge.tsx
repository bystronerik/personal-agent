import { useAuth0 } from '@auth0/auth0-react'
import { Center, Loader } from '@mantine/core'
import { type ReactNode, useEffect, useState } from 'react'

import { setTokenGetter } from './token'

/**
 * Children render only once the token getter is installed, so no request can
 * leave without an `Authorization` header.
 */
export function AuthTokenBridge({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently } = useAuth0()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setTokenGetter(getAccessTokenSilently)
    setReady(true)
  }, [getAccessTokenSilently])

  if (!ready) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  return children
}
