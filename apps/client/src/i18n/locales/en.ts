import type { ErrorCode } from '@personal-agent/schemas/common'
import type { Edition } from '@personal-agent/schemas/schedules'
import type { Locale, Theme } from '@personal-agent/schemas/users'

/**
 * Typed against the API's own union, so an error code added server-side fails
 * `pnpm build` here rather than falling back to the server's English message.
 */
const byCode: Record<ErrorCode, string> = {
  TOPIC_NOT_FOUND: 'That subject is no longer on the list',
  TOPIC_ALREADY_EXISTS: '"{{subject}}" is already on the list',
  SCHEDULE_NOT_FOUND: 'That schedule no longer exists',
  SCHEDULE_LIMIT_REACHED:
    'You already have {{limit}} schedules — delete one to add another',
  SCHEDULE_CRON_UNSUPPORTED: '"{{cron}}" is not a schedule that can be run',
  VALIDATION_FAILED: 'Some of what you entered is not valid',
  UNAUTHORIZED: 'Your session has expired — sign in again',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our side',
}

const languages: Record<Locale, string> = {
  en: 'English',
}

const themes: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
}

const editions: Record<Edition, string> = {
  morning: 'Morning brief',
  evening: 'Evening brief',
}

export const en = {
  app: {
    name: 'Personal Agent',
  },
  nav: {
    toggle: 'Toggle navigation',
    dashboard: 'Dashboard',
    schedules: 'Schedules',
    account: 'Account',
    logOut: 'Log out',
  },
  languages,
  themes,
  editions,
  auth: {
    rejected: 'Auth0 rejected the sign-in',
  },
  schedules: {
    everyDay: 'Every day',
    open: 'Open schedule',
    new: 'New schedule',
    empty: 'No briefs scheduled yet',
    cron: 'When',
    timezone: 'Time zone',
    edition: 'Edition',
    enabled: 'Enabled',
    topics: 'Topics',
    topicsHint: 'Subjects to research — press Enter after each',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'This schedule stops firing and cannot be recovered.',
    lastRun: 'Last run',
    nextRun: 'Next run',
    never: 'Never',
  },
  account: {
    signedIn: 'Signed in',
    language: 'Language',
    theme: 'Theme',
  },
  errors: {
    byCode,
    unknown: 'Something went wrong',
  },
} as const
