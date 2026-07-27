import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Stack,
  Switch,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScheduleOutput } from '../../generated/api/model'
import { useScheduleToggle } from '../../schedules/useSchedules'
import { describeCron } from './cron'

const VISIBLE_TOPICS = 2

export function CompactRowList({ schedules }: { schedules: ScheduleOutput[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'
  const { isSaving, setEnabled } = useScheduleToggle()

  return (
    <Stack gap="xs">
      {schedules.map((schedule) => {
        const { time, days } = describeCron(
          schedule.cron,
          locale,
          t('schedules.everyDay'),
        )
        const morning = schedule.edition === 'morning'

        return (
          <Card
            key={schedule.id}
            withBorder
            radius="md"
            p="sm"
            opacity={schedule.enabled ? 1 : 0.55}
          >
            <Group wrap="nowrap" gap="sm">
              <ThemeIcon
                variant="light"
                radius="md"
                size={36}
                color={morning ? 'yellow' : 'indigo'}
              >
                {morning ? <Sun size={18} /> : <Moon size={18} />}
              </ThemeIcon>

              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={500} size="sm" truncate>
                  {t(`editions.${schedule.edition}`)}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {time} · {days} · {schedule.timezone}
                </Text>
              </Stack>

              <Group gap={6} wrap="nowrap" visibleFrom="md">
                {schedule.topics.slice(0, VISIBLE_TOPICS).map((topic) => (
                  <Badge key={topic.id} size="sm" variant="light" color="gray">
                    {topic.subject}
                  </Badge>
                ))}
                {schedule.topics.length > VISIBLE_TOPICS && (
                  <Badge size="sm" variant="default">
                    +{schedule.topics.length - VISIBLE_TOPICS}
                  </Badge>
                )}
              </Group>

              <Switch
                size="sm"
                checked={schedule.enabled}
                disabled={isSaving}
                aria-label={t('schedules.enabled')}
                onChange={(event) =>
                  setEnabled(schedule.id, event.currentTarget.checked)
                }
              />

              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t('schedules.open')}
                renderRoot={(props) => (
                  <Link
                    to="/schedules/$id"
                    params={{ id: schedule.id }}
                    {...props}
                  />
                )}
              >
                <ChevronRight size={16} />
              </ActionIcon>
            </Group>
          </Card>
        )
      })}
    </Stack>
  )
}
