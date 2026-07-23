import { useAuth0 } from '@auth0/auth0-react'
import {
  Alert,
  AppShell,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import { AuthTokenBridge } from './auth/AuthTokenBridge'
import { TopicsPage } from './pages/TopicsPage'

const HEADER_HEIGHT = 56

export function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout, user } =
    useAuth0()

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
      <AppShell header={{ height: HEADER_HEIGHT }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={600}>Personal Agent</Text>
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                {user?.email ?? user?.name}
              </Text>
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() =>
                  logout({
                    logoutParams: { returnTo: window.location.origin },
                  })
                }
              >
                Log out
              </Button>
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <TopicsPage />
        </AppShell.Main>
      </AppShell>
    </AuthTokenBridge>
  )
}
