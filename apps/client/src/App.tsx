import { useAuth0 } from '@auth0/auth0-react'
import { Alert, Center, Loader } from '@mantine/core'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthTokenBridge } from './auth/AuthTokenBridge'
import { UnsubscribePage } from './pages/UnsubscribePage'
import { router } from './router'

/**
 * The one path that must render with no session: it is reached from a link in a
 * delivered brief, and a reader who wants out is exactly the reader who will not
 * sign in to get there. The check has to be *here* rather than in the router —
 * the redirect to Auth0 fires before `RouterProvider` ever mounts.
 *
 * It renders outside the router for the same reason, so the typed route tree
 * keeps describing only the authenticated portal.
 */
const PUBLIC_PATH = '/unsubscribe'

export function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()
  const { t } = useTranslation()
  const redirecting = useRef(false)
  const isPublic = window.location.pathname === PUBLIC_PATH

  useEffect(() => {
    if (
      isPublic ||
      isLoading ||
      error ||
      isAuthenticated ||
      redirecting.current
    )
      return
    redirecting.current = true
    void loginWithRedirect()
  }, [isPublic, isLoading, error, isAuthenticated, loginWithRedirect])

  if (isPublic) {
    return <UnsubscribePage />
  }

  if (error) {
    return (
      <Center h="100vh" p="md">
        <Alert color="red" title={t('auth.rejected')} maw={480}>
          {error.message}
        </Alert>
      </Center>
    )
  }

  if (!isAuthenticated) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  return (
    <AuthTokenBridge>
      <RouterProvider router={router} />
    </AuthTokenBridge>
  )
}
