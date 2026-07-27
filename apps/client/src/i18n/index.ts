import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LOCALE, LocaleSchema } from '@personal-agent/schemas/users'

import { en } from './locales/en'

const LOCALE_STORAGE_KEY = 'personal-agent.locale'

const resources = { en: { translation: en } }

/**
 * Resources are bundled rather than fetched, so `init` resolves synchronously
 * and no `<Suspense>` boundary is needed. Splitting locales into dynamic imports
 * later is what would change that.
 */
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: LocaleSchema.options,
    nonExplicitSupportedLngs: true,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  })

/**
 * `resolvedLanguage`, not `language`: detection yields the browser's own tag
 * (`en-GB`), and the document should advertise the locale actually served.
 */
const syncDocumentLanguage = () => {
  document.documentElement.lang = i18next.resolvedLanguage ?? DEFAULT_LOCALE
}

syncDocumentLanguage()
i18next.on('languageChanged', syncDocumentLanguage)

export { i18next }

declare module 'i18next' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: merging into i18next's own `CustomTypeOptions` needs an interface
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: (typeof resources)['en']
  }
}
