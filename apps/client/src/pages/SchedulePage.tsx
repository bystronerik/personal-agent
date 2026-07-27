import { Button, Card, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RequestFailure } from '../lib/RequestFailure'
import { useSchedule } from '../schedules/useSchedules'
import { ScheduleForm } from './schedules/ScheduleForm'

export function SchedulePage() {
  const { id } = useParams({ from: '/schedules/$id' })
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [confirming, confirm] = useDisclosure(false)
  const { schedule, isLoading, error, isSaving, save, remove } = useSchedule(id)

  const toList = () => navigate({ to: '/schedules' })
  const when = (at: string | null) =>
    at === null
      ? t('schedules.never')
      : new Date(at).toLocaleString(i18n.resolvedLanguage ?? 'en')

  return (
    <Stack maw={640}>
      {isLoading && <Loader size="sm" />}
      {error && <RequestFailure error={error} />}

      {schedule && (
        <>
          <Card withBorder radius="md" p="md">
            <ScheduleForm
              mode="edit"
              initialValues={{
                cron: schedule.cron,
                timezone: schedule.timezone,
                edition: schedule.edition,
                enabled: schedule.enabled,
                topics: schedule.topics.map((topic) => topic.subject),
              }}
              isSaving={isSaving}
              onCancel={toList}
              onSubmit={({ cron, timezone, edition, enabled }) =>
                save({ cron, timezone, edition, enabled }, toList)
              }
            />
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t('schedules.lastRun')}
                </Text>
                <Text size="sm">{when(schedule.lastRunAt)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t('schedules.nextRun')}
                </Text>
                <Text size="sm">{when(schedule.nextRunAt)}</Text>
              </Group>
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={confirm.open}
            >
              {t('schedules.delete')}
            </Button>
          </Group>

          <Modal
            opened={confirming}
            onClose={confirm.close}
            title={t('schedules.delete')}
          >
            <Stack>
              <Text size="sm">{t('schedules.deleteConfirm')}</Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={confirm.close}>
                  {t('schedules.cancel')}
                </Button>
                <Button
                  color="red"
                  loading={isSaving}
                  onClick={() => remove(toList)}
                >
                  {t('schedules.delete')}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </Stack>
  )
}
