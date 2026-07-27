import { useMantineColorScheme } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { UpdateUserPreferences } from '@personal-agent/schemas/users'

import {
  getGetMyPreferencesQueryKey,
  useGetMyPreferences,
  useUpdateMyPreferences,
} from '../generated/api/preferences/preferences'
import { useDescribeError } from '../lib/errors'

const OK = 200

/**
 * The one place `/me/preferences` is read and written; every preference control
 * patches through `save`, so a partial patch never drops a sibling field.
 */
export const usePreferences = () => {
  const queryClient = useQueryClient()
  const describeError = useDescribeError()

  const query = useGetMyPreferences()
  const update = useUpdateMyPreferences({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetMyPreferencesQueryKey(),
        }),
      onError: (error) =>
        notifications.show({ color: 'red', message: describeError(error) }),
    },
  })

  return {
    stored: query.data?.status === OK ? query.data.data : undefined,
    isSaving: update.isPending,
    save: (patch: UpdateUserPreferences) => update.mutate({ data: patch }),
  }
}

/**
 * The stored preferences are the source of truth; the localStorage caches
 * i18next and Mantine keep are what let the first paint pick a language and a
 * theme before any request resolves. These effects correct the rare
 * disagreement once the query lands, so the common path has no flash — which is
 * why this is mounted by the layout rather than by the page that edits them.
 */
export const usePreferenceSync = () => {
  const { i18n } = useTranslation()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const { stored } = usePreferences()

  useEffect(() => {
    if (stored && stored.locale !== i18n.resolvedLanguage) {
      i18n.changeLanguage(stored.locale)
    }
  }, [stored, i18n])

  useEffect(() => {
    if (stored && stored.theme !== colorScheme) {
      setColorScheme(stored.theme)
    }
  }, [stored, colorScheme, setColorScheme])
}
