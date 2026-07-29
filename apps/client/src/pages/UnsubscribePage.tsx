import { Alert, Button, Card, Center, Stack, Text, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { env } from '../env'

/**
 * Reached from a link in a delivered brief, with **no session**. `App.tsx` lets
 * this one path render before Auth0 is consulted, so nothing here may assume a
 * user, a token, or the generated API client.
 *
 * The API's `GET /unsubscribe` verified the token and redirected here without
 * changing anything — this page is the asking, and the button below is what
 * commits.
 */
export function UnsubscribePage() {
  const { t } = useTranslation()
  const token = new URLSearchParams(window.location.search).get('token')

  const unsubscribe = useMutation({
    mutationFn: async () => {
      const url = new URL('/unsubscribe', env.apiUrl)
      url.searchParams.set('token', token ?? '')
      const response = await fetch(url, { method: 'POST' })
      if (!response.ok) {
        throw new Error(String(response.status))
      }
    },
  })

  return (
    <Center h="100vh" p="md">
      <Card withBorder padding="lg" radius="md" maw={480} w="100%">
        <Stack gap="md">
          <Title order={3}>{t('unsubscribe.title')}</Title>

          {!token || unsubscribe.isError ? (
            <Alert color="red" title={t('unsubscribe.invalid')}>
              {t('unsubscribe.invalidDetail')}
            </Alert>
          ) : unsubscribe.isSuccess ? (
            <Alert color="green" title={t('unsubscribe.done')}>
              {t('unsubscribe.doneDetail')}
            </Alert>
          ) : (
            <>
              <Text size="sm">{t('unsubscribe.prompt')}</Text>
              <Button
                color="red"
                loading={unsubscribe.isPending}
                onClick={() => unsubscribe.mutate()}
              >
                {t('unsubscribe.confirm')}
              </Button>
            </>
          )}
        </Stack>
      </Card>
    </Center>
  )
}
