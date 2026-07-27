import { useMantineColorScheme } from '@mantine/core'

import {
  DEFAULT_THEME,
  type Theme,
  ThemeSchema,
} from '@personal-agent/schemas/users'

import { usePreferences } from './usePreferences'

export const useTheme = () => {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const { isSaving, save } = usePreferences()

  return {
    current: ThemeSchema.catch(DEFAULT_THEME).parse(colorScheme),
    isSaving,
    change: (next: Theme) => {
      setColorScheme(next)
      save({ theme: next })
    },
  }
}
