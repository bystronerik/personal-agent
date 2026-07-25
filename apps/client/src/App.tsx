import { useAuth0 } from '@auth0/auth0-react'
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { RouterProvider } from '@tanstack/react-router'

import { AuthTokenBridge } from './auth/AuthTokenBridge'
import { router } from './router'

export function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Center h="100vh" p="md">
        <Alert color="red" title="Auth0 rejected the sign-in" maw={480}>
          {error.message}
        </Alert>
      </Center>
    )
  }

  if (!isAuthenticated) {
    return (
      <Center h="100vh" p="md">
        <Paper withBorder p="xl" radius="md" w={360}>
          <Stack>
            <Title order={3}>Personal Agent</Title>
            <Text c="dimmed" size="sm">
              Sign in to choose what the brief researches.
            </Text>
            <Button onClick={() => loginWithRedirect()}>Log in</Button>
          </Stack>
        </Paper>
      </Center>
    )
  }

  return (
    <AuthTokenBridge>
      <RouterProvider router={router} />
    </AuthTokenBridge>
  )
}
