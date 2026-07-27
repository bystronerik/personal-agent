import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'

import type {
  CreateSchedule,
  UpdateSchedule,
} from '@personal-agent/schemas/schedules'

import {
  getGetScheduleQueryKey,
  getListSchedulesQueryKey,
  useCreateSchedule,
  useDeleteSchedule,
  useGetSchedule,
  useListSchedules,
  useUpdateSchedule,
} from '../generated/api/schedules/schedules'
import { useDescribeError } from '../lib/errors'

const OK = 200

/**
 * The one place `/schedules` is read and written. Each hook below mounts only
 * the queries and mutations its caller needs, so no page subscribes to a list it
 * does not render.
 */
const useMutationHandlers = () => {
  const queryClient = useQueryClient()
  const describeError = useDescribeError()

  return (id?: string) => ({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() })
      if (id) {
        queryClient.invalidateQueries({ queryKey: getGetScheduleQueryKey(id) })
      }
    },
    onError: (error: unknown) =>
      notifications.show({ color: 'red', message: describeError(error) }),
  })
}

export const useSchedules = () => {
  const query = useListSchedules()

  return {
    schedules: query.data?.status === OK ? query.data.data : undefined,
    isLoading: query.isPending,
    error: query.error,
  }
}

export const useScheduleToggle = () => {
  const update = useUpdateSchedule({ mutation: useMutationHandlers()() })

  return {
    isSaving: update.isPending,
    setEnabled: (id: string, enabled: boolean) =>
      update.mutate({ id, data: { enabled } }),
  }
}

export const useSchedule = (id: string) => {
  const handlers = useMutationHandlers()

  const query = useGetSchedule(id)
  const update = useUpdateSchedule({ mutation: handlers(id) })
  const remove = useDeleteSchedule({ mutation: handlers(id) })

  return {
    schedule: query.data?.status === OK ? query.data.data : undefined,
    isLoading: query.isPending,
    error: query.error,
    isSaving: update.isPending || remove.isPending,
    save: (patch: UpdateSchedule, onSaved: () => void) =>
      update.mutate({ id, data: patch }, { onSuccess: onSaved }),
    // 204 leaves orval's response type with only an error arm; the mutator
    // throws before a non-OK response resolves, so reaching here is the success.
    remove: (onRemoved: () => void) =>
      remove.mutate({ id }, { onSuccess: onRemoved }),
  }
}

export const useScheduleCreation = () => {
  const create = useCreateSchedule({ mutation: useMutationHandlers()() })

  return {
    isSaving: create.isPending,
    create: (input: CreateSchedule, onCreated: () => void) =>
      create.mutate({ data: input }, { onSuccess: onCreated }),
  }
}
