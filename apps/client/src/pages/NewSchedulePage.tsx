import { Card, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'

import { useScheduleCreation } from '../schedules/useSchedules'
import { emptySchedule, ScheduleForm } from './schedules/ScheduleForm'

export function NewSchedulePage() {
  const navigate = useNavigate()
  const { create, isSaving } = useScheduleCreation()

  const toList = () => navigate({ to: '/schedules' })

  return (
    <Stack maw={640}>
      <Card withBorder radius="md" p="md">
        <ScheduleForm
          mode="create"
          initialValues={emptySchedule()}
          isSaving={isSaving}
          onCancel={toList}
          onSubmit={(values) => create(values, toList)}
        />
      </Card>
    </Stack>
  )
}
