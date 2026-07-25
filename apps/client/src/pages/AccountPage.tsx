import { useAuth0 } from '@auth0/auth0-react'
import {
  Alert,
  Avatar,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import { useGetMe } from '../generated/api/me/me'
import { describe } from '../lib/errors'

export function AccountPage() {
  const { user } = useAuth0()
  const me = useGetMe()

  const identity = me.data?.status === 200 ? me.data.data : undefined

  return (
    <Stack maw={640}>
      <div>
        <Title order={2}>Account</Title>
        <Text c="dimmed" size="sm">
          The identity the brief runs as.
        </Text>
      </div>

      <Card withBorder padding="md" radius="md">
        <Group wrap="nowrap">
          <Avatar src={user?.picture} radius="xl" />
          <Stack gap={2}>
            <Text fw={500}>{user?.name ?? 'Signed in'}</Text>
            <Text size="sm" c="dimmed">
              {user?.email}
            </Text>
          </Stack>
        </Group>
      </Card>

      {me.isPending && <Loader />}

      {me.isError && (
        <Alert color="red" title="Could not load your account">
          {describe(me.error)}
        </Alert>
      )}

      {identity && (
        <Card withBorder padding="md" radius="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              User ID the API sees
            </Text>
            <Text ff="monospace" size="sm">
              {identity.userId}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
