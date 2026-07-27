import { Button, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MAX_SCHEDULES_PER_USER } from '@personal-agent/schemas/schedules'

import { RequestFailure } from '../lib/RequestFailure'
import { useSchedules } from '../schedules/useSchedules'
import { CompactRowList } from './schedules/CompactRowList'

export function SchedulesPage() {
  const { t } = useTranslation()
  const { schedules, isLoading, error } = useSchedules()

  return (
    <Stack maw={880}>
      <Group justify="flex-end">
        <Button
          leftSection={<Plus size={16} />}
          disabled={(schedules?.length ?? 0) >= MAX_SCHEDULES_PER_USER}
          renderRoot={(props) => <Link to="/schedules/new" {...props} />}
        >
          {t('schedules.new')}
        </Button>
      </Group>

      {isLoading && <Loader size="sm" />}
      {error && <RequestFailure error={error} />}

      {schedules &&
        (schedules.length === 0 ? (
          <Card withBorder radius="md" p="lg">
            <Text size="sm" c="dimmed" ta="center">
              {t('schedules.empty')}
            </Text>
          </Card>
        ) : (
          <CompactRowList schedules={schedules} />
        ))}
    </Stack>
  )
}
