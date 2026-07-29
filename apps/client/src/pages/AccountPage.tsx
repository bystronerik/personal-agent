import { useAuth0 } from '@auth0/auth0-react'
import {
  Avatar,
  Card,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { LocaleSchema, ThemeSchema } from '@personal-agent/schemas/users'

import { useLocale } from '../i18n/useLocale'
import { usePreferences } from '../preferences/usePreferences'
import { useTheme } from '../preferences/useTheme'
import { DeliveryCard } from './account/DeliveryCard'

const CONTROL_WIDTH = 200

export function AccountPage() {
  const { user } = useAuth0()
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const { stored } = usePreferences()

  return (
    <Stack maw={640}>
      <Card withBorder padding="md" radius="md">
        <Group wrap="nowrap">
          <Avatar src={user?.picture} radius="xl" />
          <Stack gap={2}>
            <Text fw={500}>{user?.name ?? t('account.signedIn')}</Text>
            <Text size="sm" c="dimmed">
              {user?.email}
            </Text>
          </Stack>
        </Group>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t('account.language')}</Text>
            <Select
              w={CONTROL_WIDTH}
              allowDeselect={false}
              checkIconPosition="right"
              disabled={locale.isSaving}
              value={locale.current}
              data={LocaleSchema.options.map((value) => ({
                value,
                label: t(`languages.${value}`),
              }))}
              onChange={(value) =>
                value && locale.change(LocaleSchema.parse(value))
              }
            />
          </Group>

          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t('account.theme')}</Text>
            <SegmentedControl
              disabled={theme.isSaving}
              value={theme.current}
              data={ThemeSchema.options.map((value) => ({
                value,
                label: t(`themes.${value}`),
              }))}
              onChange={(value) => theme.change(ThemeSchema.parse(value))}
            />
          </Group>
        </Stack>
      </Card>

      {stored && <DeliveryCard stored={stored} />}
    </Stack>
  )
}
