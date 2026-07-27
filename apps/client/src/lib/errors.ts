import type { TFunction } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from './api-fetcher'

/**
 * The API's `errorCode` and `params` are what make a failure translatable — the
 * `message` beside them is already-rendered English, and stands in only for a
 * failure from in front of the API, which carries no code.
 */
export const describe = (error: unknown, t: TFunction): string => {
  if (error instanceof ApiError && error.errorCode) {
    return t(`errors.byCode.${error.errorCode}`, error.params)
  }
  if (error instanceof Error) {
    return error.message
  }
  return t('errors.unknown')
}

export const useDescribeError = () => {
  const { t } = useTranslation()
  return useCallback((error: unknown) => describe(error, t), [t])
}
