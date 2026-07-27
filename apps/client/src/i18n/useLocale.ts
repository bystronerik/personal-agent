import { useTranslation } from 'react-i18next'

import {
  DEFAULT_LOCALE,
  type Locale,
  LocaleSchema,
} from '@personal-agent/schemas/users'

import { usePreferences } from '../preferences/usePreferences'

export const useLocale = () => {
  const { i18n } = useTranslation()
  const { isSaving, save } = usePreferences()

  return {
    current: LocaleSchema.catch(DEFAULT_LOCALE).parse(i18n.resolvedLanguage),
    isSaving,
    change: (locale: Locale) => {
      i18n.changeLanguage(locale)
      save({ locale })
    },
  }
}
