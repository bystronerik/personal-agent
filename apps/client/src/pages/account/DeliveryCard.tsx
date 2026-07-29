import {
  Alert,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DeliveryChannelSchema,
  TelegramChatIdSchema,
  type UserPreferences,
} from '@personal-agent/schemas/users'

import { usePreferences } from '../../preferences/usePreferences'

const CONTROL_WIDTH = 220

/** Empty is not invalid — it is how a reader removes a chat id. */
const chatIdProblem = (value: string): string | undefined => {
  if (value === '') return undefined
  const parsed = TelegramChatIdSchema.safeParse(value)
  return parsed.success ? undefined : parsed.error.issues[0]?.message
}

export function DeliveryCard({ stored }: { stored: UserPreferences }) {
  const { t } = useTranslation()
  const { isSaving, save, resumeEmail } = usePreferences()
  const [chatId, setChatId] = useState(stored.telegramChatId ?? '')

  const problem = chatIdProblem(chatId)
  const isEdited = chatId !== (stored.telegramChatId ?? '')

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Text fw={500}>{t('delivery.title')}</Text>

        {stored.emailSuspendedAt && stored.emailSuspendedReason && (
          <Alert color="red" title={t('delivery.suspended')}>
            <Stack gap="sm" align="flex-start">
              <Text size="sm">
                {t(`suspensionReasons.${stored.emailSuspendedReason}`, {
                  date: new Date(stored.emailSuspendedAt).toLocaleDateString(),
                })}
              </Text>
              <Button size="xs" loading={isSaving} onClick={resumeEmail}>
                {t('delivery.resume')}
              </Button>
            </Stack>
          </Alert>
        )}

        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{t('delivery.channel')}</Text>
          <SegmentedControl
            disabled={isSaving}
            value={stored.deliveryChannel}
            data={DeliveryChannelSchema.options.map((value) => ({
              value,
              label: t(`channels.${value}`),
            }))}
            onChange={(value) =>
              save({ deliveryChannel: DeliveryChannelSchema.parse(value) })
            }
          />
        </Group>

        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text size="sm">{t('delivery.address')}</Text>
          <Stack gap={2} w={CONTROL_WIDTH}>
            <Text size="sm" c={stored.email ? undefined : 'dimmed'}>
              {stored.email ?? t('delivery.addressPending')}
            </Text>
            {stored.email && !stored.emailVerified && (
              <Text size="xs" c="orange">
                {t('delivery.unverified')}
              </Text>
            )}
          </Stack>
        </Group>

        {/* Rendered whatever the channel is: the API rejects Telegram without a
            chat id, so the field has to be reachable before that choice. */}
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text size="sm">{t('delivery.chatId')}</Text>
          <Stack gap="xs" w={CONTROL_WIDTH}>
            <TextInput
              value={chatId}
              disabled={isSaving}
              error={problem}
              description={t('delivery.chatIdHint')}
              onChange={(event) => setChatId(event.currentTarget.value)}
            />
            {isEdited && !problem && (
              <Button
                size="xs"
                loading={isSaving}
                onClick={() => save({ telegramChatId: chatId || null })}
              >
                {t('delivery.save')}
              </Button>
            )}
          </Stack>
        </Group>
      </Stack>
    </Card>
  )
}
