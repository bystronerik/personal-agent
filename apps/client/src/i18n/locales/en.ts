import type { ErrorCode } from '@personal-agent/schemas/common'
import type { Edition } from '@personal-agent/schemas/schedules'
import type {
  DeliveryChannel,
  EmailSuspensionReason,
  Locale,
  Theme,
} from '@personal-agent/schemas/users'

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
  DELIVERY_TELEGRAM_CHAT_ID_REQUIRED:
    'Add your Telegram chat id before choosing Telegram',
  DELIVERY_EMAIL_UNAVAILABLE: 'There is no email address to deliver to yet',
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

const channels: Record<DeliveryChannel, string> = {
  email: 'Email',
  telegram: 'Telegram',
}

const suspensionReasons: Record<EmailSuspensionReason, string> = {
  unsubscribed: 'You unsubscribed from email briefs on {{date}}.',
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
  channels,
  suspensionReasons,
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
  delivery: {
    title: 'Brief delivery',
    channel: 'Deliver by',
    address: 'Email address',
    addressPending: 'Not synced from Auth0 yet',
    unverified:
      'Not verified — briefs are held until you confirm it with Auth0',
    chatId: 'Telegram chat id',
    chatIdHint: 'Message the bot, then run `pnpm telegram:chat-id` to find it',
    save: 'Save',
    suspended: 'Email delivery is off',
    resume: 'Resume email delivery',
  },
  unsubscribe: {
    title: 'Unsubscribe from email briefs',
    prompt:
      'Confirm and Personal Agent will stop emailing your briefs. Your schedules stay as they are — you can turn delivery back on from your account at any time.',
    confirm: 'Unsubscribe',
    done: 'Unsubscribed',
    doneDetail:
      'No more briefs will be emailed to you. Sign in to your account to turn delivery back on.',
    invalid: 'That unsubscribe link is not valid',
    invalidDetail:
      'It may have been truncated by your mail client. Sign in to your account to change delivery instead.',
  },
  errors: {
    byCode,
    unknown: 'Something went wrong',
  },
} as const
