import { z } from 'zod'

/**
 * A closed set, not a BCP-47 string: the portal derives its `supportedLngs` from
 * `LocaleSchema.options`, so a locale the UI has no bundle for cannot be stored.
 * Adding one means a bundle here and a deploy of both sides.
 */
export const LocaleSchema = z.enum(['en']).meta({ id: 'Locale' })
export type Locale = z.infer<typeof LocaleSchema>

/** Mirrors `User.locale`'s database default, which no migration can import. */
export const DEFAULT_LOCALE = 'en' satisfies Locale

/**
 * `auto` rather than `system` because the members are Mantine's own
 * `MantineColorScheme` values — the portal hands a stored value straight to
 * `setColorScheme`, and renaming a member buys a mapping layer and nothing else.
 */
export const ThemeSchema = z
  .enum(['light', 'dark', 'auto'])
  .meta({ id: 'Theme' })
export type Theme = z.infer<typeof ThemeSchema>

/** Mirrors `User.theme`'s database default, which no migration can import. */
export const DEFAULT_THEME = 'auto' satisfies Theme

export const DeliveryChannelSchema = z
  .enum(['email', 'telegram'])
  .meta({ id: 'DeliveryChannel' })
export type DeliveryChannel = z.infer<typeof DeliveryChannelSchema>

/** Mirrors `User.deliveryChannel`'s database default, which no migration can import. */
export const DEFAULT_DELIVERY_CHANNEL = 'email' satisfies DeliveryChannel

/** A numeric id (negative for groups and channels) or an `@public_name`. */
const TELEGRAM_CHAT_ID = /^(-?\d+|@\w{5,})$/

/**
 * A field validator rather than a component, so no `.meta({ id })` — an id would
 * put a bare string in the OpenAPI document as a schema of its own.
 *
 * `packages/env` validates `TELEGRAM_CHAT_ID` with the same grammar and its own
 * copy of it. The two are no longer one contract: that variable now serves only
 * the `telegram:*` dev scripts, while delivery reads the column this describes.
 */
export const TelegramChatIdSchema = z
  .string()
  .regex(TELEGRAM_CHAT_ID, 'expected a numeric chat id or an @public_name')

/**
 * Why email delivery stopped. A closed set so the portal can translate it;
 * only an unsubscribe produces one today.
 */
export const EmailSuspensionReasonSchema = z
  .enum(['unsubscribed'])
  .meta({ id: 'EmailSuspensionReason' })
export type EmailSuspensionReason = z.infer<typeof EmailSuspensionReasonSchema>

/**
 * The half a reader owns. Everything else in `UserPreferencesSchema` is written
 * by the server — the address comes from Auth0, the suspension from an
 * unsubscribe — so a single schema partialled into a patch would advertise
 * fields no `PATCH` may set.
 */
const writable = {
  locale: LocaleSchema,
  theme: ThemeSchema,
  deliveryChannel: DeliveryChannelSchema,
  telegramChatId: TelegramChatIdSchema.nullable(),
}

export const UserPreferencesSchema = z
  .object({
    ...writable,
    email: z.email().nullable(),
    emailVerified: z.boolean(),
    emailSuspendedAt: z.iso.datetime().nullable(),
    emailSuspendedReason: EmailSuspensionReasonSchema.nullable(),
  })
  .meta({ id: 'UserPreferences' })
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

/**
 * `telegram` requires a chat id, and that rule cannot live here: a patch setting
 * only `deliveryChannel` is valid against a row that already has one. The API
 * enforces it against the merged result.
 */
export const UpdateUserPreferencesSchema = z
  .object(writable)
  .partial()
  .meta({ id: 'UpdateUserPreferences' })
export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>
