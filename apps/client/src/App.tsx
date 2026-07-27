import { useAuth0 } from '@auth0/auth0-react'
import { Alert, Center, Loader } from '@mantine/core'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthTokenBridge } from './auth/AuthTokenBridge'
import { router } from './router'

export function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()
  const { t } = useTranslation()
  const redirecting = useRef(false)

  useEffect(() => {
    if (isLoading || error || isAuthenticated || redirecting.current) return
    redirecting.current = true
    void loginWithRedirect()
  }, [isLoading, error, isAuthenticated, loginWithRedirect])

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
